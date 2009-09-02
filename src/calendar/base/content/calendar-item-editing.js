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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Parmenter <stuart.parmenter@oracle.com>
 *   Robin Edrenius <robin.edrenius@gmail.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

function opCompleteListener(aOriginalItem, aOuterListener) {
    this.mOriginalItem = aOriginalItem;
    this.mOuterListener = aOuterListener;
}

opCompleteListener.prototype = {
    mOriginalItem: null,
    mOuterListener: null,

    onOperationComplete: function oCL_onOperationComplete(aCalendar, aStatus, aOpType, aId, aItem) {
        if (Components.isSuccessCode(aStatus)) {
            // we may optionally shift the whole check and send mail messages to
            // calProviderBase.notifyOperationComplete (with adding an oldItem parameter).
            // I am not yet sure what to do for mixed mode invitations, e.g.
            // some users on the attendee list are caldav users and get REQUESTs into their inbox,
            // other get emailed... For now let's do both.
            checkAndSendItipMessage(aItem, aOpType, this.mOriginalItem);
        }
        if (this.mOuterListener) {
            this.mOuterListener.onOperationComplete.apply(this.mOuterListener,
                                                          arguments);
        }
    },

    onGetItem: function oCL_onGetResult(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {

    }
};

/* all params are optional */
function createEventWithDialog(calendar, startDate, endDate, summary, event, aForceAllday) {
    const kDefaultTimezone = calendarDefaultTimezone();

    var onNewEvent = function(item, calendar, originalItem, listener) {
        if (item.id) {
            // If the item already has an id, then this is the result of
            // saving the item without closing, and then saving again.
            doTransaction('modify', item, calendar, originalItem, listener);
        } else {
            // Otherwise, this is an addition
            doTransaction('add', item, calendar, null, listener);
        }
    };

    if (event) {
        if (!event.isMutable) {
            event = event.clone();
        }
        // If the event should be created from a template, then make sure to
        // remove the id so that the item obtains a new id when doing the
        // transaction
        event.id = null;

        if (aForceAllday) {
            event.startDate.isDate = true;
            event.endDate.isDate = true;
            if (event.startDate.compare(event.endDate) == 0) {
                // For a one day all day event, the end date must be 00:00:00 of
                // the next day.
                event.endDate.day++;
            }
        }
    } else {
        event = createEvent();

        if (startDate) {
            event.startDate = startDate.clone();
            if (startDate.isDate && !aForceAllday) {
                // This is a special case where the date is specified, but the
                // time is not. To take care, we setup up the time to our
                // default event start time.
                event.startDate = getDefaultStartDate(event.startDate);
            } else if (aForceAllday) {
                // If the event should be forced to be allday, then don't set up
                // any default hours and directly make it allday.
                event.startDate.isDate = true;
                event.startDate.timezone = floating();
            }
        } else {
            // If no start date was passed, then default to the next full hour
            // of today, but with the date of the selected day
            var refDate = currentView().initialized && currentView().selectedDay.clone();
            event.startDate = getDefaultStartDate(refDate);
        }

        if (endDate) {
            event.endDate = endDate.clone();
            if (aForceAllday) {
                // XXX it is currently not specified, how callers that force all
                // day should pass the end date. Right now, they should make
                // sure that the end date is 00:00:00 of the day after.
                event.endDate.isDate = true;
                event.endDate.timezone = floating();
            }
        } else {
            event.endDate = event.startDate.clone();
            if (!aForceAllday) {
                // If the event is not all day, then add the default event
                // length.
                event.endDate.minute += getPrefSafe("calendar.event.defaultlength", 60);
            } else {
                // All day events need to go to the beginning of the next day.
                event.endDate.day++;
            }
        }

        event.calendar = calendar || getSelectedCalendar();

        if (summary) {
            event.title = summary;
        }

        setDefaultAlarmValues(event);
    }
    openEventDialog(event, calendar, "new", onNewEvent, null);
}

function createTodoWithDialog(calendar, dueDate, summary, todo) {
    const kDefaultTimezone = calendarDefaultTimezone();

    var onNewItem = function(item, calendar, originalItem, listener) {
        if (item.id) {
            // If the item already has an id, then this is the result of
            // saving the item without closing, and then saving again.
            doTransaction('modify', item, calendar, originalItem, listener);
        } else {
            // Otherwise, this is an addition
            doTransaction('add', item, calendar, null, listener);
        }
    }

    if (todo) {
        // If the too should be created from a template, then make sure to
        // remove the id so that the item obtains a new id when doing the
        // transaction
        if (todo.id) {
            todo = todo.clone();
            todo.id = null;
        }
    } else {
        todo = createTodo();
        todo.calendar = calendar || getSelectedCalendar();

        if (summary)
            todo.title = summary;

        if (dueDate)
            todo.dueDate = dueDate;

        setDefaultAlarmValues(todo);
    }

    openEventDialog(todo, calendar, "new", onNewItem, null);
}


function modifyEventWithDialog(aItem, job, aPromptOccurrence) {
    var onModifyItem = function(item, calendar, originalItem, listener) {
        doTransaction('modify', item, calendar, originalItem, listener);
    };

    var item = aItem;
    var futureItem, response;
    if (aPromptOccurrence !== false) {
        [item, futureItem, response] = promptOccurrenceModification(aItem, true, "edit");
    }

    if (item && (response || response === undefined)) {
        openEventDialog(item, item.calendar, "modify", onModifyItem, job);
    } else if (job && job.dispose) {
        // If the action was canceled and there is a job, dispose it directly.
        job.dispose();
    }
}

function itemObserver(componentURL, openArgs) {
    this.componentURL = componentURL;
    this.openArgs = openArgs;
}

itemObserver.prototype = {
    observe: function(aSubject, aTopic, aData) {
        if (aData) {
            var parts = aData.split("/");
            if (this.componentURL == parts[parts.length-1]) {
                var obsService = Components.classes["@mozilla.org/observer-service;1"]
                                           .getService(Components.interfaces.nsIObserverService);
                obsService.removeObserver(this,
                                          "caldav-component-acl-loaded", false);
                obsService.removeObserver(this,
                                          "caldav-component-acl-reset", false);
                openEventDialog.apply(window, this.openArgs);
            }
        }
    }
};

function loadItemCalDAVAclEntry(aclMgr, item, calendar, openArgs) {
    var realCalendar = calendar.getProperty("cache.uncachedCalendar");
    if (!realCalendar) {
        realCalendar = calendar;
    }
    realCalendar = realCalendar.wrappedJSObject;
    var cache = realCalendar.mItemInfoCache;
    var compEntry = null;
    if (cache[item.id]) {
        var compURL = cache[item.id].locationPath;
        var obsService = Components.classes["@mozilla.org/observer-service;1"]
                                   .getService(Components.interfaces.nsIObserverService);
        var obs = new itemObserver(compURL, openArgs);
        obsService.addObserver(obs, "caldav-component-acl-loaded", false);
        obsService.addObserver(obs, "caldav-component-acl-reset", false);
        compEntry = aclMgr.componentEntry(calendar.uri, compURL);
        if (compEntry.isComponentReady()) {
            obsService.removeObserver(obs, "caldav-component-acl-loaded", false);
            obsService.removeObserver(obs, "caldav-component-acl-reset", false);
        } else {
            compEntry = null;
        }
    }

    return compEntry;
}

function openEventDialog(calendarItem, calendar, mode, callback, job) {
    // Set up some defaults
    mode = mode || "new";
    var compAclEntry = null;

    try {
        var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                               .getService(Components.interfaces.nsISupports)
                               .wrappedJSObject;
        if (mode == "modify" && calendar.type == "caldav"
            && !isCalendarWritable(calendar)) {
            compAclEntry = loadItemCalDAVAclEntry(aclMgr, calendarItem,
                                                  calendar, arguments);
            if (!compAclEntry) {
                return;
            }
        }
    }
    catch(e) {}

    calendar = calendar || getSelectedCalendar();
    var calendars = getCalendarManager().getCalendars({});
    calendars = calendars.filter(isCalendarWritable);

    var isItemSupported;
    if (isToDo(calendarItem)) {
        isItemSupported = function isTodoSupported(cal) {
            return (cal.getProperty("capabilities.tasks.supported") !== false);
        };
    } else if (isEvent(calendarItem)) {
        isItemSupported = function isEventSupported(cal) {
            return (cal.getProperty("capabilities.events.supported") !== false);
        };
    }

    // Filter out calendars that don't support the given calendar item
    calendars = calendars.filter(isItemSupported);

    if (mode == "new" && calendars.length < 1 &&
        (!isCalendarWritable(calendar) || !isItemSupported(calendar))) {
        // There are no writable calendars or no calendar supports the given
        // item. Don't show the dialog.
        return;
    } else if (mode == "new" &&
               (!isCalendarWritable(calendar) || !isItemSupported(calendar))) {
        // Pick the first calendar that supports the item and is writable
        calendar = calendars[0];
        if (calendarItem) {
            // XXX The dialog currently uses the items calendar as a first
            // choice. Since we are shortly before a release to keep regression
            // risk low, explicitly set the item's calendar here.
            calendarItem.calendar = calendars[0];
        }
    }

    // Setup the window arguments
    var args = new Object();
    args.calendarEvent = calendarItem;
    args.calendar = calendar;
    args.mode = mode;
    args.onOk = callback;
    args.job = job;

    // this will be called if file->new has been selected from within the dialog
    args.onNewEvent = function(calendar) {
        createEventWithDialog(calendar, null, null);
    }

    // the dialog will reset this to auto when it is done loading.
    window.setCursor("wait");

    // ask the provide if this item is an invitation. if this is the case
    // we'll open the summary dialog since the user is not allowed to change
    // the details of the item.
    var isInvitation = false;
    if (calInstanceOf(calendar, Components.interfaces.calISchedulingSupport)) {
        isInvitation = calendar.isInvitation(calendarItem);
    }

    // open the dialog modeless
    var url;
    if (mode == "new"
        || (mode == "modify"
            && !isInvitation
            && (isCalendarWritable(calendar)
                || (compAclEntry && compAclEntry.userCanModify())))) {
        url = "chrome://calendar/content/sun-calendar-event-dialog.xul";
    } else {
        url = "chrome://calendar/content/calendar-summary-dialog.xul";
    }
    openDialog(url, "_blank", "chrome,titlebar,resizable", args);
}

/**
 * Prompts the user how the passed item should be modified. If the item is an
 * exception or already a parent item, the item is returned without prompting.
 * If "all occurrences" is specified, the parent item is returned. If "this
 * occurrence only" is specified, then aItem is returned. If "this and following
 * occurrences" is selected, aItem's parentItem is modified so that the
 * recurrence rules end (UNTIL) just before the given occurrence. If
 * aNeedsFuture is specified, a new item is made from the part that was stripped
 * off the passed item.
 *
 * EXDATEs and RDATEs that do not fit into the items recurrence are removed. If
 * the modified item or the future item only consist of a single occurrence,
 * they are changed to be single items.
 *
 * @param aItem                         The item to check.
 * @param aNeedsFuture                  If true, the future item is parsed.
 *                                        This parameter can for example be
 *                                        false if a deletion is being made.
 * @param aAction                       Either "edit" or "delete". Sets up
 *                                          the labels in the occurrence prompt
 * @return [modifiedItem, futureItem, promptResponse]
 *                                      If "this and all following" was chosen,
 *                                        an array containing the item *until*
 *                                        the given occurrence (modifiedItem),
 *                                        and the item *after* the given
 *                                        occurrence (futureItem).
 *
 *                                        If any other option was chosen,
 *                                        futureItem is null  and the
 *                                        modifiedItem is either the parent item
 *                                        or the passed occurrence, or null if
 *                                        the dialog was canceled.
 *
 *                                        The promptResponse parameter gives the
 *                                        response of the dialog as a constant.
 */
function promptOccurrenceModification(aItem, aNeedsFuture, aAction) {
    const CANCEL = 0;
    const MODIFY_OCCURRENCE = 1;
    const MODIFY_FOLLOWING = 2;
    const MODIFY_PARENT = 3;

    var futureItem = false;
    var pastItem;
    var type = CANCEL;

    // Check if this actually is an instance of a recurring event
    if (aItem == aItem.parentItem) {
        type = MODIFY_PARENT;
    } else if (aItem.parentItem.recurrenceInfo
               .getExceptionFor(aItem.recurrenceId, false) != null) {
        // If the user wants to edit an occurrence which is already an exception
        // always edit this single item.
        // XXX  Why? I think its ok to ask also for exceptions.
        type = MODIFY_OCCURRENCE;
    } else {
        // Prompt the user. Setting modal blocks the dialog until it is closed. We
        // use rv to pass our return value.
        var rv = { value: CANCEL, item: aItem, action: aAction};
        window.openDialog("chrome://calendar/content/calendar-occurrence-prompt.xul",
                          "prompt-occurrence-modification",
                          "centerscreen,chrome,modal,titlebar",
                          rv);
        type = rv.value;
    }

    switch (type) {
    case MODIFY_PARENT:
        pastItem = aItem.parentItem;
        break;
    case MODIFY_FOLLOWING:
        // TODO tbd in a different bug
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        break;
    case MODIFY_OCCURRENCE:
        pastItem = aItem;
        break;
    case CANCEL:
        // Since we have not set past or futureItem, the return below will
        // take care.
        break;
    }

    return [pastItem, futureItem, type];
}

/**
 * Read default alarm settings from user preferences and apply them to
 * the event/todo passed in.
 *
 * @param aItem   The event or todo the settings should be applied to.
 */
function setDefaultAlarmValues(aItem)
{
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    var alarmsBranch = prefService.getBranch("calendar.alarms.");

    if (isEvent(aItem)) {
        try {
            if (alarmsBranch.getIntPref("onforevents") == 1) {
                var alarmOffset = Components.classes["@mozilla.org/calendar/duration;1"]
                                            .createInstance(Components.interfaces.calIDuration);
                var units = alarmsBranch.getCharPref("eventalarmunit");
                alarmOffset[units] = alarmsBranch.getIntPref("eventalarmlen");
                alarmOffset.isNegative = true;
                aItem.alarmOffset = alarmOffset;
                aItem.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;
            }
        } catch (ex) {
            Components.utils.reportError(
                                         "Failed to apply default alarm settings to event: " + ex);
        }
    } else if (isToDo(aItem)) {
        try {
            if (alarmsBranch.getIntPref("onfortodos") == 1) {
                // You can't have an alarm if the entryDate doesn't exist.
                if (!aItem.entryDate) {
                    aItem.entryDate = getSelectedDay() &&
                        getSelectedDay().clone() || now();
                }
                var alarmOffset = Components.classes["@mozilla.org/calendar/duration;1"]
                                            .createInstance(Components.interfaces.calIDuration);
                var units = alarmsBranch.getCharPref("todoalarmunit");
                alarmOffset[units] = alarmsBranch.getIntPref("todoalarmlen");
                alarmOffset.isNegative = true;
                aItem.alarmOffset = alarmOffset;
                aItem.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;
            }
        } catch (ex) {
            Components.utils.reportError(
                                         "Failed to apply default alarm settings to task: " + ex);
        }
    }
}

// Undo/Redo code
function getTransactionMgr() {
    return Components.classes["@mozilla.org/calendar/transactionmanager;1"]
                     .getService(Components.interfaces.calITransactionManager);
}

function doTransaction(aAction, aItem, aCalendar, aOldItem, aListener) {
    var innerListener = new opCompleteListener(aOldItem, aListener);
    getTransactionMgr().createAndCommitTxn(aAction,
                                           aItem,
                                           aCalendar,
                                           aOldItem,
                                           innerListener);
    updateUndoRedoMenu();
}

function undo() {
    if (canUndo()) {
        getTransactionMgr().undo();
        updateUndoRedoMenu();
    }
}

function redo() {
    if (canRedo()) {
        getTransactionMgr().redo();
        updateUndoRedoMenu();
    }
}

function startBatchTransaction() {
    getTransactionMgr().beginBatch();
}
function endBatchTransaction() {
    getTransactionMgr().endBatch();
    updateUndoRedoMenu();
}

function canUndo() {
    return getTransactionMgr().canUndo();
}
function canRedo() {
    return getTransactionMgr().canRedo();
}

/**
 * Update the undo and redo menu items
 */
function updateUndoRedoMenu() {
    goUpdateCommand("cmd_undo");
    goUpdateCommand("cmd_redo");
}

/**
 * helper for delegation in checkAndSendItipItems
 */
function makeDelegateItem(aItem, method, rID, attendee, otherAttendees) {
    var delegateItem = aItem.clone();
    if (method != "REPLY"
        && (delegateItem.organizer.id.toLowerCase()
            != attendee.id.toLowerCase())) {
        delegateItem.organizer.setProperty("SENT-BY", attendee.id);
    }
    delegateItem.removeAllAttendees();
    for each (var otherAttendee in otherAttendees) {
        delegateItem.addAttendee(otherAttendee);
    }
    delegateItem.addAttendee(attendee);

    var itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                             .createInstance(Components.interfaces.calIItipItem);
    itipItem.init(calGetSerializedItem(delegateItem));
    itipItem.targetCalendar = aItem.calendar;
    itipItem.autoResponse = Components.interfaces.calIItipItem.USER;
    itipItem.responseMethod = method;
    // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
    if (rID) {
        itipItem.getItemList({})[0].setProperty("RECURRENCE-ID", rID);
    }

    return itipItem;
}

/**
 * (helper for delegation in checkAndSendItipItems)
 * retrieve the chain of delegates/delegators
 */
function findDelegationAttendees(aItem, delegationQualifier, delegate) {
    var attendees = {};

    // dump("qualifier: " + delegationQualifier + "\n");
    var currentAttendee = aItem.getAttendeeById(delegate.id);
    while (currentAttendee) {
        // dump("  current delegate/delegator: " + currentAttendee.id + "\n");
        var attendeeId = currentAttendee.getProperty(delegationQualifier);
        if (attendeeId && attendeeId.length > 0) {
            currentAttendee = aItem.getAttendeeById(attendeeId);
            if (currentAttendee) {
                attendees[currentAttendee.id.toLowerCase()] = currentAttendee;
            } else {
                // dump("  ** not found\n");
            }
        } else {
            currentAttendee = null;
        }
    }

    return attendees;
}

function serializedItem(aItem) {
    var serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                               .createInstance(Components.interfaces.calIIcsSerializer);
    serializer.addItems([aItem], 1);
    var serializedItem = serializer.serializeToString();
    return serializedItem;
}

/**
 * Checks to see if the attendees were added or changed between the original
 * and new item.  If there is a change, it launches the calIItipTransport
 * service and sends the invitations
 */
function checkAndSendItipMessage(aItem, aOpType, aOriginalItem) {
    var transport = aItem.calendar.getProperty("itip.transport");
    if (!transport) { // Only send if there's a transport for the calendar
        return;
    }

    var rID = null;

    // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
    // We need to see if an EXDATE has been added and if so, during ITIP, we
    // must send only a RECURRENCE-ID. We do this by checking if we have a new
    // EXDATE defined inside our new item, comparing it to our old one. If
    // we have a new EXDATE, we take this, strip the item with the recurring
    // information and we send it over with the RECURRENCE-ID.
    var itemEx = [];
    if (aItem.recurrenceInfo)
        itemEx = aItem.recurrenceInfo.getRecurrenceItems({}).filter(function (x) { return (x.isNegative && calInstanceOf(x, Components.interfaces.calIRecurrenceDate));} );

    if (aOriginalItem && aOriginalItem.recurrenceInfo) {
        var origEx = aOriginalItem.recurrenceInfo.getRecurrenceItems({}).filter(function (x) { return (x.isNegative && calInstanceOf(x, Components.interfaces.calIRecurrenceDate));} );
        if (itemEx.length != origEx.length) {
            var exMap = {};
            for each (var ex in origEx) {
                exMap[ex.date] = ex;
            }

            // We check for newly created EXDATE
            for each (var ex in itemEx) {
                if (!(ex.date in exMap)) {
                    var duration;

                    duration = aItem.duration;

                    aItem = aItem.clone();
                    aItem.recurrenceInfo = null;
                    rID = ex.date;

                    aItem.endDate = ex.date.clone();
                    aItem.endDate.addDuration(duration);
                    aItem.startDate = ex.date;

                    aOpType = Components.interfaces.calIOperationListener.DELETE;
                    break;
                }
            }
        }
    }
    // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
    // We must get the proper modified occurence since Lightning pass us
    // the parent item.
    else if (aOriginalItem && aOriginalItem.recurrenceId) {
        aItem = aItem.clone();
        aItem = aItem.recurrenceInfo.getExceptionFor(aOriginalItem.recurrenceId, false);
    }

    transport = transport.QueryInterface(Components.interfaces.calIItipTransport);
    var invitedAttendee = ((calInstanceOf(aItem.calendar, Components.interfaces.calISchedulingSupport) &&
                            aItem.calendar.isInvitation(aItem))
                           ? aItem.calendar.getInvitedAttendee(aItem) : null);
    if (invitedAttendee) { // actually is an invitation copy, fix attendee list to send REPLY
        if (aItem.calendar.canNotify("REPLY", aItem)) {
            return; // provider does that
        }
        var origInvitedAttendee = (aOriginalItem && aOriginalItem.getAttendeeById(invitedAttendee.id));
        origInvitedAttendee = invitedAttendee;
        invitedAttendee = invitedAttendee.clone();

        if (aOpType == Components.interfaces.calIOperationListener.DELETE) {
            // in case the attendee has just deleted the item, we want to send out a DECLINED REPLY:
            invitedAttendee.participationStatus = "DECLINED";
        }

        // Much like in sun-calendar-event-dialog-attendees.xml (onInitialize)
        // we have to check if the attendee is equal to the calendar-user-address-set.
        // If they aren't equal, it means that someone is accepting invitations
        // on behalf of an other user.
        if (aItem.calendar.type == "caldav") {
            try {
                // Inverse inc. ACL addition
                var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                                       .getService(Components.interfaces.nsISupports)
                                       .wrappedJSObject;

                var entry = aclMgr.calendarEntry(aItem.calendar.uri);
                var found = false;
                var identity;

                for (var i = 0; i < entry.userAddresses.length; i++) {
                    identity = entry.userAddresses[i].toLowerCase();
                    if (invitedAttendee.id.toLowerCase() == identity) {
                        found = true;
                    }
                }

                if (!found && entry.userAddresses.length > 0) {
                    invitedAttendee.setProperty("SENT-BY", entry.userAddresses[0]);
                }
            } catch (ex) {
                // NO ACL support
            }
        }

        // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
        if (aOriginalItem && aOriginalItem.recurrenceId) {
            aItem.organizer = aItem.parentItem.organizer;
        }

        // has this been a PARTSTAT change?
        if (aItem.organizer) { // &&

            //(!origInvitedAttendee ||
            // (origInvitedAttendee.participationStatus != invitedAttendee.participationStatus))) {
            //var rID = null;

            // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
            if (aOriginalItem && aOriginalItem.recurrenceId) {
                rID = aItem.getProperty("RECURRENCE-ID");
                aItem.recurrenceId = null;
            } else {
                aItem = aItem.clone();
            }

            var delegatorsHash = findDelegationAttendees(aItem,
                                                         "DELEGATED-FROM",
                                                         invitedAttendee);
            var delegators = [];
            for (var delegator in delegatorsHash) {
                delegators.push(delegator);
            }

            // dump("\noriginal ICS:\n" + serializedItem(aOriginalItem) + "\n\n");
            // dump("\nnew      ICS:\n" + serializedItem(aItem) + "\n\n");

            var newDelegates = findDelegationAttendees(aItem, "DELEGATED-TO",
                                                       invitedAttendee);

            var oldDelegates = null;
            if (aOriginalItem) {
                var oldAttendee
                    = aOriginalItem.getAttendeeById(invitedAttendee.id);
                if (oldAttendee
                    && oldAttendee.participationStatus == "DELEGATED") {
                    oldDelegates = findDelegationAttendees(aOriginalItem,
                                                           "DELEGATED-TO",
                                                           invitedAttendee);
                    // dump("oldDelegates queried\n");
                } else {
                    // dump("oldAttendee not delegated\n");
                }
            } else {
                // dump("no original item\n");
            }

            aItem.removeAllAttendees();
            for each (var delegator in delegators) {
                aItem.addAttendee(delegator);
            }
            aItem.addAttendee(invitedAttendee);
            for (var delegate in newDelegates) {
                aItem.addAttendee(newDelegates[delegate]);
            }

            var itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                                     .createInstance(Components.interfaces.calIItipItem);
            itipItem.init(calGetSerializedItem(aItem));

            // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
            if (rID) {
                itipItem.getItemList({})[0].setProperty("RECURRENCE-ID", rID);
            }

            itipItem.targetCalendar = aItem.calendar;
            itipItem.autoResponse = Components.interfaces.calIItipItem.USER;
            itipItem.responseMethod = "REPLY";
            transport.sendItems(1 + delegators.length,
                                [aItem.organizer].concat(delegators),
                                itipItem);

            var requestDelegates = [];
            var cancelDelegates = [];
            if (oldDelegates) {
                for (var oldDelegate in oldDelegates) {
                    if (newDelegates[oldDelegate]) {
                        if (newDelegates[oldDelegate].participationStatus
                            != oldDelegates[oldDelegate].participationStatus
                            && (newDelegates[oldDelegate].participationStatus
                                == "NEEDS-ACTION")) {
                            requestDelegates.push(newDelegates[oldDelegate]);
                        }
                    } else {
                        // dump("append old delegate: " + oldDelegate + "\n");
                        cancelDelegates.push(oldDelegates[oldDelegate]);
                    }
                }

                for (var newDelegate in newDelegates) {
                    if (!oldDelegates[newDelegate]) {
                        requestDelegates.push(newDelegates[newDelegate]);
                    }
                }
            } else {
                for (var newDelegate in newDelegates) {
                    requestDelegates.push(newDelegates[newDelegate]);
                }
            }

            if (requestDelegates.length > 0) {
                var requestItipItem
                    = makeDelegateItem(aItem, "REQUEST", rID,
                                       invitedAttendee,
                                       delegators.concat(requestDelegates));
                transport.sendItems(requestDelegates.length, requestDelegates,
                                    requestItipItem);
            }
            if (cancelDelegates.length > 0) {
                var cancelItipItem
                    = makeDelegateItem(aOriginalItem, "CANCEL", rID,
                                       invitedAttendee,
                                       delegators.concat(cancelDelegates));
                transport.sendItems(cancelDelegates.length, cancelDelegates,
                                    cancelItipItem);
            }
        }
        return;
    }

    // HACK - We send invitation unconditionally. Why we wouldn't
    // anyway if we invoked this method?
    //if (aItem.getProperty("X-MOZ-SEND-INVITATIONS") != "TRUE") { // Only send invitations/cancellations
    //                                                             // if the user checked the checkbox
    //    return;
    // }

    if (aOpType == Components.interfaces.calIOperationListener.DELETE) {
        calSendItipMessage(transport, aItem, "CANCEL", aItem.getAttendees({}), false, rID);
        return;
    } // else ADD, MODIFY:

    var originalAtt = (aOriginalItem ? aOriginalItem.getAttendees({}) : []);
    var itemAtt = aItem.getAttendees({});
    var canceledAttendees = [];
    var addedAttendees = [];

    if (itemAtt.length > 0 || originalAtt.length > 0) {
        var attMap = {};
        for each (var att in originalAtt) {
            attMap[att.id.toLowerCase()] = att;
        }

        // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
        // We need to fix the attendee list so that we send invitation
        // requests to newly added attendees
        for each (var addedAtt in itemAtt) {
            if (!(addedAtt.id.toLowerCase() in attMap)) {
                addedAttendees.push(addedAtt);
            }
        }

        for each (var att in itemAtt) {
            if (att.id.toLowerCase() in attMap) {
                // Attendee was in original item.
                delete attMap[att.id.toLowerCase()];
            }
        }

        for each (var cancAtt in attMap) {
            canceledAttendees.push(cancAtt);
        }
    }
    var autoResponse = false; // confirm to send email

    // Check to see if some part of the item was updated, if so, re-send invites
    if (!aOriginalItem || aItem.generation != aOriginalItem.generation ||
        aItem.getProperty("SEQUENCE") != aOriginalItem.getProperty("SEQUENCE") || addedAttendees.length > 0) {
        var requestItem = aItem;

        // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
        if (aOriginalItem && aOriginalItem.recurrenceId) {
            rID = requestItem.getProperty("RECURRENCE-ID");
            requestItem.recurrenceId = null;
        } else {
            requestItem = aItem.clone();
        }

        if (!requestItem.organizer) {
            var organizer = Components.classes["@mozilla.org/calendar/attendee;1"]
                                      .createInstance(Components.interfaces.calIAttendee);
            organizer.id = requestItem.calendar.getProperty("organizerId");
            organizer.commonName = requestItem.calendar.getProperty("organizerCN");
            organizer.role = "REQ-PARTICIPANT";
            organizer.participationStatus = "ACCEPTED";
            organizer.isOrganizer = true;
            requestItem.organizer = organizer;
        }

        // Fix up our attendees for invitations using some good defaults
        var recipients = [];
        var itemAtt = [];
        var attMap = {};

        itemAtt = requestItem.getAttendees({});
        requestItem.removeAllAttendees();

        // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
        for each (var attendee in addedAttendees) {
            attMap[attendee.id.toLowerCase()] = attendee;
            attendee = attendee.clone();
            attendee.role = "REQ-PARTICIPANT";
            attendee.participationStatus = "NEEDS-ACTION";
            attendee.rsvp = true;
            requestItem.addAttendee(attendee);
            recipients.push(attendee);
        }

        // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
        for each (var attendee in itemAtt) {
            if (attendee.id.toLowerCase() in attMap)
                continue; // already handled the attendee, we skip it.

            attendee = attendee.clone();
            if (attendee.participationStatus != "DELEGATED"
                && (!aOriginalItem || aItem.getProperty("SEQUENCE") != aOriginalItem.getProperty("SEQUENCE"))) {
                attendee.role = "REQ-PARTICIPANT";
                attendee.participationStatus = "NEEDS-ACTION";
                attendee.rsvp = true;
            }
            requestItem.addAttendee(attendee);

            /* We must statute on the "NON-PARTICIPANT" or "RSVP" flags. */
            // if (attendee.participationStatus != "DELEGATED"
            //     || attendee.role == "NON-PARTICIPANT") {
            recipients.push(attendee);
            // }
        }

        if (recipients.length > 0) {
            calSendItipMessage(transport, requestItem, "REQUEST", recipients, autoResponse, rID);
            autoResponse = true; // don't ask again
        }
    }
    // Cancel the event for all canceled attendees
    if (canceledAttendees.length > 0) {
        var cancelItem = aOriginalItem.clone();
        cancelItem.removeAllAttendees();
        if (cancelItem && cancelItem.recurrenceId) {
            rID = cancelItem.getProperty("RECURRENCE-ID");
            cancelItem.recurrenceId = null;
        }
        for each (var att in canceledAttendees) {
            cancelItem.addAttendee(att);
        }
        calSendItipMessage(transport, cancelItem, "CANCEL", canceledAttendees, autoResponse, rID);
    }
}

function calSendItipMessage(aTransport, aItem, aMethod, aRecipientsList, autoResponse, rID) {
    if (aRecipientsList.length == 0) {
        return;
    }
    if (calInstanceOf(aItem.calendar, Components.interfaces.calISchedulingSupport) &&
        aItem.calendar.canNotify(aMethod, aItem)) {
        return; // provider will handle that
    }

    var itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                             .createInstance(Components.interfaces.calIItipItem);

    // We have to modify our item a little, so we clone it.
    var item = aItem.clone();

    // Initialize and set our properties on the item
    itipItem.init(calGetSerializedItem(item));

    // HACK around bug https://bugzilla.mozilla.org/show_bug.cgi?id=396182
    // We need to add the RECURRENCE-ID _AFTER_ we serialized the item.
    // Otherwise, we'll get an exception.
    if (rID) {
        itipItem.getItemList({})[0].setProperty("RECURRENCE-ID", rID);
    }

    itipItem.responseMethod = aMethod;
    itipItem.targetCalendar = item.calendar;
    itipItem.autoResponse = (autoResponse
                             ? Components.interfaces.calIItipItem.AUTO
                             : Components.interfaces.calIItipItem.USER);
    // XXX I don't know whether the below are used at all, since we don't use the itip processor
    itipItem.isSend = true;

    // Send it!
    aTransport.sendItems(aRecipientsList.length, aRecipientsList, itipItem);
}

function calGetSerializedItem(aItem) {
    var serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                               .createInstance(Components.interfaces.calIIcsSerializer);
    serializer.addItems([aItem], 1);
    return serializer.serializeToString();
}
