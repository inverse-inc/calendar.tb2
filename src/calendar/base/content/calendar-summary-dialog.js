/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Berend Cornelius <berend.cornelius@sun.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

function onLoad() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    item = item.clone(); // use an own copy of the passed item
    var calendar = item.calendar;
    window.item = item;

    // the calling entity provides us with an object that is responsible
    // for recording details about the initiated modification. the 'finalize'-property
    // is our hook in order to receive a notification in case the operation needs
    // to be terminated prematurely. this function will be called if the calling
    // entity needs to immediately terminate the pending modification. in this
    // case we serialize the item and close the window.
    if (args.job) {

        // keep this context...
        var self = this;

        // store the 'finalize'-functor in the provided job-object.
        args.job.finalize = function finalize() {

            // store any pending modifications...
            self.onAccept();

            var item = window.item;

            // ...and close the window.
            window.close();

            return item;
        }
    }

    // INVERSE - BEGIN
    //window.readOnly = calendar.readOnly;
    window.readOnly = true;
    if (isCalendarWritable(calendar)) {
        window.readOnly = false;
    } else {
        var aclMgr;
        try {
            aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                               .getService(Components.interfaces.nsISupports)
                               .wrappedJSObject;
        } catch(e) {
            aclMgr = null;
        }
        if (calendar.type == "caldav" && aclMgr) {
            var realCalendar = calendar.getProperty("cache.uncachedCalendar");
            if (!realCalendar) {
                realCalendar = calendar;
            }
            realCalendar = realCalendar.wrappedJSObject;
            var cache = realCalendar.mItemInfoCache;
            if (cache[item.id]) {
                /* We don't need to setup an observer here as we know the
                   entry was initialized from calendar-item-editing.js */
                var compEntry = aclMgr.componentEntry(calendar.uri,
                                                      cache[item.id].locationPath);
                if (compEntry && compEntry.isComponentReady()) {
                    window.readOnly = !(compEntry.userCanModify()
                                        || compEntry.userCanRespond());
                }
            }
        }
    }
    // INVERSE - END
    if (!window.readOnly && calInstanceOf(calendar, Components.interfaces.calISchedulingSupport)) {
        var attendee = calendar.getInvitedAttendee(item);
        if (attendee) {
            // if this is an unresponded invitation, preset our default alarm values:
            if (attendee.participationStatus == "NEEDS-ACTION") {
                setDefaultAlarmValues(item);
            }

            window.attendee = attendee.clone();
            // Since we don't have API to update an attendee in place, remove
            // and add again. Also, this is needed if the attendee doesn't exist
            // (i.e REPLY on a mailing list)
            item.removeAttendee(attendee);
            item.addAttendee(window.attendee);
        }
    }

    document.getElementById("item-title").value = item.title;

    document.getElementById("item-start-row").Item = item;
    document.getElementById("item-end-row").Item = item;

    updateInvitationStatus();

    // show reminder if this item is *not* readonly.
    // this case happens for example if this is an invitation.
    var calendar = window.arguments[0].calendarEvent.calendar;
    var supportsReminders =
        (calendar.getProperty("capabilities.alarms.oninvitations.supported") !== false);
    if (!window.readOnly && supportsReminders) {
        document.getElementById("reminder-row").removeAttribute("hidden");
        loadReminder(window.item);
        updateReminderDetails();
    }

    updateRepeatDetails();
    updateAttendees();
    updateLink();

    var location = item.getProperty("LOCATION");
    if (location && location.length) {
        document.getElementById("location-row").removeAttribute("hidden");
        document.getElementById("item-location").value = location;
    }

    var categories = item.getCategories({});
    if (categories.length > 0) {
        document.getElementById("category-row").removeAttribute("hidden");
        document.getElementById("item-category").value = categories.join(", "); // TODO l10n-unfriendly
    }

    var organizer = item.organizer;
    if (organizer && organizer.id) {
        document.getElementById("organizer-row").removeAttribute("hidden");

        if (organizer.commonName && organizer.commonName.length) {
            document.getElementById("item-organizer").value = organizer.commonName;
            document.getElementById("item-organizer").setAttribute("tooltiptext", organizer.toString());
        } else if (organizer.id && organizer.id.length) {
            document.getElementById("item-organizer").value = organizer.toString();
        }
    }

    var status = item.getProperty("STATUS");
    if (status && status.length) {
        var statusRow = document.getElementById("status-row");
        for (var i = 0; i < statusRow.childNodes.length; i++) {
            if (statusRow.childNodes[i].getAttribute("status") == status) {
                statusRow.removeAttribute("hidden");
                statusRow.childNodes[i].removeAttribute("hidden");
                break;
            }
        }
    }

    if (item.hasProperty("DESCRIPTION")) {
        var description = item.getProperty("DESCRIPTION");
        if (description && description.length) {
            document.getElementById("item-description-box")
                .removeAttribute("hidden");
            var textbox = document.getElementById("item-description");
            textbox.value = description;
            textbox.inputField.readOnly = true;
        }
    }

    document.title = item.title;

    // If this item is read only we remove the 'cancel' button as users
    // can't modify anything, thus we go ahead with an 'ok' button only.
    if (window.readOnly) {
        document.getElementById("calendar-summary-dialog")
            .getButton("cancel").setAttribute("collapsed", "true");
    }

    window.focus();
    opener.setCursor("auto");
}

function saveDelegationInfo() {
    var validated = true;

    var oldDelegate = null;
    var keepOldDelegate = false;
    var oldDelegateEmail = window.attendee.getProperty("DELEGATED-TO");
    if (oldDelegateEmail && oldDelegateEmail.length > 0) {
        oldDelegate = window.item.getAttendeeById(oldDelegateEmail);
    }

    if (window.attendee.participationStatus == "DELEGATED") {
        var delegateField = document.getElementById("item-delegate");
        // var delegateCB = document.getElementById("item-delegate-staytuned");

        var emails = {};
        var names = {};
        var parser = Components
                         .classes["@mozilla.org/messenger/headerparser;1"]
                         .getService(Components.interfaces.nsIMsgHeaderParser);
        parser.parseHeadersWithArray(delegateField.value, emails, names, {});
        if (emails.value.length > 0 && emails.value[0].indexOf("@") > 0) {
            var newDelegateEmail = "mailto:" + emails.value[0];
            if (newDelegateEmail == oldDelegateEmail) {
                keepOldDelegate = true;
            } else {
                if (window.item.getAttendeeById(newDelegateEmail)) {
                    window.alert(calGetString("sun-calendar-event-dialog",
                                              "The selected delegate is already present in the attendees list."));
                    validated = false;
                } else {
                    var newDelegate
                        = Components.classes["@mozilla.org/calendar/attendee;1"]
                        .createInstance(Components.interfaces.calIAttendee);
                    newDelegate.isOrganizer = false;
                    newDelegate.id = newDelegateEmail;
                    newDelegate.participationStatus = "NEEDS-ACTION";
                    newDelegate.role = "REQ-PARTICIPANT";
                    newDelegate.rsvp = "TRUE";
                    if (names.value[0].length > 0) {
                        newDelegate.commonName = names.value[0];
                    }
                    newDelegate.setProperty("DELEGATED-FROM", window.attendee.id);
                    window.attendee.setProperty("DELEGATED-TO", newDelegateEmail);
                    window.item.addAttendee(newDelegate);
                    // if (delegateCB.checked) {
                    //     window.attendee.role = "NON-PARTICIPANT";
                    // } else {
                    //     window.attendee.role = "";
                    // }
                }
            }
        } else {
            window.alert(calGetString("sun-calendar-event-dialog",
                                      "The delegate must be a valid contact name."));
            delegateField.select();
            validated = false;
        }
    } else {
        window.attendee.deleteProperty("DELEGATED-TO");
        window.attendee.role = "REQ-PARTICIPANT";
        window.attendee.rsvp = "TRUE";
    }

    if (!keepOldDelegate && oldDelegate) {
        var oldDelegates = findDelegationAttendees(window.item,
                                                   "DELEGATED-TO",
                                                   oldDelegate);
        window.item.removeAttendee(oldDelegate);
        // dump("summary: old delegates: " + oldDelegates.join(", ") + "\n");
        for (var i = 0; i < oldDelegates.length; i++) {
            window.item.removeAttendee(oldDelegates[i]);
        }
    }

    return validated;
}

function onAccept() {
    dispose();
    if (window.readOnly) {
        return true;
    }

    if (calInstanceOf(window.item, Components.interfaces.calIEvent)
        && !saveDelegationInfo())
        return false;

    var args = window.arguments[0];
    var oldItem = args.calendarEvent;
    var newItem = window.item;
    var calendar = newItem.calendar;
    saveReminder(newItem);
    args.onOk(newItem, calendar, oldItem);
    window.item = newItem;
    return true;
}

function onCancel() {
    dispose();
    return true;
}

function updateInvitationStatus() {
    var item = window.item;
    var calendar = item.calendar;
    if (!window.readOnly) {
        if (window.attendee && window.attendee.rsvp) {
            var invitationRow =
                document.getElementById("invitation-row");
            invitationRow.removeAttribute("hidden");
            var statusElement =
                document.getElementById("item-participation");
            statusElement.value = attendee.participationStatus;
            var delegate = document.getElementById("item-delegate");
            // var delegateCB = document.getElementById("item-delegate-staytuned");
            if (statusElement.value == "DELEGATED") {
                delegate.removeAttribute("collapsed");
                // delegateCB.removeAttribute("disabled");
                var delegateEmail = window.attendee.getProperty("DELEGATED-TO");
                if (delegateEmail && delegateEmail.length > 0) {
                    var delegateAtt
                        = window.item.getAttendeeById(delegateEmail);
                    var email = delegateEmail.replace(/^mailto:/i, "");
                    var name = delegateAtt.commonName;
                    if (name && name.length) {
                        name += " <" + email + ">";
                    } else {
                        name = email;
                    }
                    delegate.value = name;
                }
            } else {
                delegate.setAttribute("collapsed", "true");
                // delegateCB.setAttribute("disabled", "true");
            }
        }
    }
}

function updateInvitation() {
    var statusElement = document.getElementById("item-participation");
    if (window.attendee) {
        window.attendee.participationStatus = statusElement.value;
        var delegate = document.getElementById("item-delegate");
        // var delegateCB = document.getElementById("item-delegate-staytuned");
        if (statusElement.value == "DELEGATED") {
            delegate.removeAttribute("collapsed");
            // delegateCB.removeAttribute("disabled");
        } else {
            delegate.setAttribute("collapsed", "true");
            // delegateCB.setAttribute("disabled", "true");
        }
    }
}

function updateRepeatDetails() {
    var args = window.arguments[0];
    var item = args.calendarEvent;

    // step to the parent (in order to show the
    // recurrence info which is stored at the parent).
    item = item.parentItem;

    // retrieve a valid recurrence rule from the currently
    // set recurrence info. bail out if there's more
    // than a single rule or something other than a rule.
    var recurrenceInfo = item.recurrenceInfo;
    if (!recurrenceInfo) {
        return;
    }

    document.getElementById("repeat-row").removeAttribute("hidden");

    // First of all collapse the details text. If we fail to
    // create a details string, we simply don't show anything.
    // this could happen if the repeat rule is something exotic
    // we don't have any strings prepared for.
    var repeatDetails = document.getElementById("repeat-details");
    repeatDetails.setAttribute("collapsed", "true");

    // Try to create a descriptive string from the rule(s).
    var kDefaultTimezone = calendarDefaultTimezone();
    var startDate =  item.startDate || item.entryDate;
    var endDate = item.endDate || item.dueDate;
    startDate = startDate ? startDate.getInTimezone(kDefaultTimezone) : null;
    endDate = endDate ? endDate.getInTimezone(kDefaultTimezone) : null;
    var detailsString = recurrenceRule2String(recurrenceInfo, startDate,
                                              endDate, startDate.isDate);

    // Now display the string...
    if (detailsString) {
        var lines = detailsString.split("\n");
        repeatDetails.removeAttribute("collapsed");
        while (repeatDetails.childNodes.length > lines.length) {
            repeatDetails.removeChild(repeatDetails.lastChild);
        }
        var numChilds = repeatDetails.childNodes.length;
        for (var i = 0; i < lines.length; i++) {
            if (i >= numChilds) {
                var newNode = repeatDetails.childNodes[0]
                                           .cloneNode(true);
                repeatDetails.appendChild(newNode);
            }
            repeatDetails.childNodes[i].value = lines[i];
        }
    }
}

function updateAttendees() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    var attendees = item.getAttendees({});

    if (attendees && attendees.length) {
        document.getElementById("item-attendees").removeAttribute("hidden");
        var listbox = document.getElementById("item-attendee-listbox");
        var modelNode = listbox.getElementsByTagName("listitem")[0];
        listbox.removeChild(modelNode);
        for each (var attendee in attendees) {
            if (attendee.participationStatus != "DELEGATED") {
                var itemNode = modelNode.cloneNode(true);
                listbox.appendChild(itemNode);
                var listcell = itemNode.getElementsByTagName("listcell")[0];
                var image = itemNode.getElementsByTagName("image")[0];
                var label = itemNode.getElementsByTagName("label")[0];
                if (attendee.role) {
                    listcell.setAttribute("role", attendee.role);
                }
                if (window.attendee && attendee.id == window.attendee.id) {
                    listcell.className += " owner-attendee";
                }
                if (attendee.commonName && attendee.commonName.length) {
                    label.value = attendee.commonName;
                    // XXX While this is correct from a XUL standpoint, it doesn't
                    // seem to work on the listcell. Working around this would be an
                    // evil hack, so I'm waiting for it to be fixed in the core
                    // code instead.
                    listcell.setAttribute("tooltiptext", attendee.toString());
                } else {
                    label.value = attendee.toString();
                }
                var delegatedFrom = attendee.getProperty("DELEGATED-FROM");
                if (delegatedFrom && delegatedFrom.length > 0) {
                    var delegatorLabel = (calGetString("sun-calendar-event-dialog",
                                                      "delegated from")
                                          + " ");
                    var delegator = item.getAttendeeById(delegatedFrom);
                    if (delegator) {
                        var delegatorName = delegator.commonName;
                        if (delegatorName && delegatorName.length > 0) {
                            delegatorLabel += delegatorName;
                        } else {
                            delegatorLabel += delegator.toString();
                        }
                    } else {
                        delegatorLabel += " unspecified attendee (bug)";
                    }
                    label.value += ", " + delegatorLabel;
                }
                if (attendee.participationStatus) {
                    image.setAttribute("status",
                                       attendee.participationStatus);
                }
                image.removeAttribute("hidden");
            }
        }
    }
}

function updateReminder() {
    commonUpdateReminder();
}

function browseDocument() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    var url = item.getProperty("URL")
    launchBrowser(url);
}

function sendMailToOrganizer() {
    var args = window.arguments[0];
    var item = args.calendarEvent;

    var organizer = item.organizer;
    if (organizer) {
        if (organizer.id && organizer.id.length) {
            var email = organizer.id.replace(/^mailto:/i, "");

            // Set up the subject
            var emailSubject = calGetString("sun-calendar-event-dialog",
                                            "emailSubjectReply",
                                            [item.title]);

            sendMailTo(email, emailSubject);
        }
    }
}
