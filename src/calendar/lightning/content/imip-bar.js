/* -*- Mode: java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Simdesk Technologies Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Clint Talbert <ctalbert.moz@gmail.com>
 *   Matthew Willis <lilmatt@mozilla.com>
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

/* wsourdeau@inverse.ca - bugs: 
   - must work without caldav-acl-manager;
   - handle the case when the caldav calendar containing the item is
     unavailable
   - handle the methods != "REQUEST"
   - we must ignore the calendar containing the item IF the sequence number
     is too old */

/**
 * This bar lives inside the message window.
 * Its lifetime is the lifetime of the main thunderbird message window.
 */

var gItipItem;
var gCalItemsArrayFound = [];

var gIMIPCalendars;
var gIdentities = null;

const onItipItem = {
    observe: function observe(subject, topic, state) {
        if (topic == "onItipItemCreation") {
            checkForItipItem(subject);
        }
    }
};


function idump(X) {
    dump("[imip-bar] " + X + "\n");
}

// /**
//  * Function to get a composite calendar of all registered read-write calendars.
//  *
//  * @return composite calendar
//  */
// function createItipCompositeCalendar() {
//     var compCal = Components.classes["@mozilla.org/calendar/calendar;1?type=composite"]
//                             .createInstance(Components.interfaces.calICompositeCalendar);
//     var aclMgr = null;

//     // Inverse inc. ACL addition
//     try {
//       aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
//                .getService(Components.interfaces.nsISupports)
//                .wrappedJSObject;
//     } catch (ex) {
//       // No ACL support
//     }
//     getCalendarManager().getCalendars({}).forEach(function(cal) {
//             // We only add calendars for which we are the owner
//             if (aclMgr && cal.type == "caldav") {
//                 var entry = aclMgr.calendarEntry(cal.uri);
//                 if (entry.isCalendarReady() && entry.userIsOwner()) {
//                     compCal.addCalendar(cal);
//                 }
//             }
//             else
//                 compCal.addCalendar(cal);
//         });

//     return compCal;
// }

function checkForItipItem(subject) {
    var itipItem;
    try {
        if (!subject) {
            var msgUri = GetLoadedMessage();
            var sinkProps = msgWindow.msgHeaderSink.properties;
            // This property was set by LightningTextCalendarConverter.js
            itipItem = sinkProps.getPropertyAsInterface("itipItem",
                                                        Components.interfaces.calIItipItem);
        }
    } catch (e) {
        // This will throw on every message viewed that doesn't have the
        // itipItem property set on it. So we eat the errors and move on.

        // XXX TODO: Only swallow the errors we need to. Throw all others.
        return;
    }

    // Get the recipient identity and save it with the itip item.
    itipItem.identity = getMsgRecipient();

    // We are only called upon receipt of an invite, so ensure that isSend
    // is false.
    itipItem.isSend = false;

    // XXX Get these from preferences
    itipItem.autoResponse = Components.interfaces.calIItipItem.USER;

    var imipMethod = getMsgImipMethod();
    if (imipMethod &&
        imipMethod.length != 0 &&
        imipMethod.toLowerCase() != "nomethod")
    {
        itipItem.receivedMethod = imipMethod;
    } else {
        // There is no METHOD in the content-type header (spec violation).
        // Fall back to using the one from the itipItem's ICS.
        imipMethod = itipItem.receivedMethod;
    }

    gItipItem = itipItem;

    // XXX Bug 351742: no S/MIME or spoofing protection yet
    // handleImipSecurity(imipMethod);
    setupIMIPCalendars(imipMethod);
}

window.addEventListener("load", imipOnLoad, true);
window.addEventListener("unload", imipOnUnload, true);

/**
 * Add self to gMessageListeners defined in msgHdrViewOverlay.js
 */
function imipOnLoad() {
    var listener = {};
    listener.onStartHeaders = onImipStartHeaders;
    listener.onEndHeaders = onImipEndHeaders;
    gMessageListeners.push(listener);

    // Set up our observers
    var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                                .getService(Components.interfaces.nsIObserverService);
    observerSvc.addObserver(onItipItem, "onItipItemCreation", false);
}

function imipOnUnload() {
    var imipBar = document.getElementById("imip-bar");

    if (imipBar) {
      imipBar.setAttribute("collapsed", "true");
      hideElement("imip-button1");
      hideElement("imip-button2");
      hideElement("imip-button3");
    }

    var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                                .getService(Components.interfaces.nsIObserverService);
    observerSvc.removeObserver(onItipItem, "onItipItemCreation");

    gItipItem = null;
    gCalItemsArrayFound = [];
}

function onImipStartHeaders() {
    var imipBar = document.getElementById("imip-bar");
    imipBar.setAttribute("collapsed", "true");
    hideElement("imip-button1");
    hideElement("imip-button2");
    hideElement("imip-button3");

    // A new message is starting.
    // Clear our iMIP/iTIP stuff so it doesn't contain stale information.
    imipMethod = "";
    gItipItem = null;
}

/**
 * Required by MessageListener. no-op
 */
function onImipEndHeaders() {
    // no-op
}

function recipientMatchIdentities(identities) {
    setupMsgIdentities();
    var matchIdentities = false;

    idump("recipientMatchIdentities");

    for (var i = 0; !matchIdentities && i < gIdentities.Count(); i++) {
        var testIdentity = gIdentities.GetElementAt(i)
                           .QueryInterface(Components.interfaces.nsIMsgIdentity);
        idump("test identity: " + testIdentity.email);
        for (var j = 0; !matchIdentities && j < identities.length; j++) {
            idump("  identity: " + identities[j].email);
            matchIdentities = (identities[j].email == testIdentity.email);
        }
    }

    return matchIdentities;
}

function allUserCalendars() {
    var allCalendars = [];

    var mgr = getCalendarManager();
    var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                 .getService(Components.interfaces.nsISupports)
                 .wrappedJSObject;
    var cals = mgr.getCalendars({}).forEach(function(cal) {
        if (isCalendarWritable(cal)) {
            if (cal.type == "caldav") {
                idump("  uri: " + cal.uri.spec);
                var entry = aclMgr.calendarEntry(cal.uri);
                var calIdentities;
                if (entry.isCalendarReady()) {
                    calIdentities = entry.ownerIdentities;
                } else {
                    calIdentities = [];
                    var imipIdentity = cal.getProperty["imip.identity"];
                    if (imipIdentity) {
                        calIdentities.push(imipIdentity);
                    }
                }
                if (recipientMatchIdentities(calIdentities)) {
                    allCalendars.push(cal);
                }
            } else {
                idump("non-caldav calendar: " + cal.name);
                allCalendars.push(cal);
            }
        }
    });

    return allCalendars;
}

function findItipItemCalendar(calendars) {
    var foundCalendar = null;
    var calendarItem = null;

    var onFindItemListener = {
        found: [],
        onOperationComplete: function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
        },

        onGetResult: function ogr(aCalendar, aStatus, aItemType, aDetail,
                                  aCount, aItems) {
            if (aCount > 0) {
                foundCalendar = aCalendar;
                calendarItem = aItems[0];
            }
        }
    };

    var itemList = gItipItem.getItemList({});
    for (var i = 0; !foundCalendar && i < calendars.length; i++) {
        calendars[i].getItem(itemList[0].id, onFindItemListener);
    }

    if (foundCalendar) {
        return [foundCalendar, calendarItem];
    } else {
        return null;
    }
}

function imipBarRefreshObserver(calendars, callback, data) {
    this.callback = callback;
    this.data = data;
    this.pendingRefresh = calendars.length;

    this.allCalendars = calendars;
    this.calendars = {};
    for each (var cal in calendars) {
        idump("  added " + cal.uri.spec);
        this.calendars[cal.uri.spec] = true;
    }
}

imipBarRefreshObserver.prototype = {
    onLoad: function(aCalendar) {
        var uri = aCalendar.uri.spec;
        if (this.calendars[uri]) {
            delete this.calendars[uri];
            aCalendar.removeObserver(this);
            this.pendingRefresh--;
            idump("refresh done on " + aCalendar.name);
            if (this.pendingRefresh == 0) {
                this.callback(this.allCalendars, this.data);
            }
        }
    },

    onStartBatch: function() {},
    onEndBatch: function() {},
    onAddItem: function(aItem) {},
    onModifyItem: function(aNewItem, aOldItem) {},
    onDeleteItem: function(aDeletedItem) {},
    onError: function(aCalendar, aErrNo, aMessage) {},
    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {},
    onPropertyDeleting: function(aCalendar, aName) {}
};

function refreshCalendars(calendars, callback, data) {
    var refreshObserver = new imipBarRefreshObserver(calendars,
                                                     callback,
                                                     data);
    for each (var cal in calendars) {
        cal.addObserver(refreshObserver);
        if (cal.getProperty("requiresNetwork")) {
            idump("refresh requested on " + cal.name);
            cal.refresh();
        } else {
            idump("refresh not needed for " + cal.name);
            refreshObserver.onLoad(cal);
        }
    }
}

function imipCalDAVComponentACLEntryObserver(calendar, componentURL,
                                             imipMethod) {
    this.calendar = calendar;
    this.componentURL = componentURL;
    this.imipMethod = imipMethod;
}

imipCalDAVComponentACLEntryObserver.prototype = {
 observe: function(aSubject, aTopic, aData) {
        if (aData.component && this.componentURL == aData.component) {
            var obsService = Components.classes["@mozilla.org/observer-service;1"]
                             .getService(Components.interfaces.nsIObserverService);
            obsService.removeObserver(this,
                                      "caldav-component-acl-loaded", false);
            obsService.removeObserver(this,
                                      "caldav-component-acl-reset", false);
            if (aTopic == "caldav-component-acl-loaded") {
                var entry = aData.entry;
                if (entry.userCanModify() || entry.userCanRespond()) {
                    gIMIPCalendars = [this.calendar];
                }
            }
        }
    }
};

function checkCalendarOwningItem(calendar, item, imipMethod) {
    var proceed = true;
    if (calendar.type == "caldav") {
        var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                     .getService(Components.interfaces.nsISupports)
                     .wrappedJSObject;
        var calEntry = aclMgr.calendarEntry(calendar.uri);
        if (calEntry.hasAccessControl) {
            var realCalendar = calendar.getProperty("cache.uncachedCalendar");
            if (realCalendar) {
                realCalendar = calendar;
            }
            realCalendar = realCalendar.wrappedJSObject;
            var cache = realCalendar.mItemInfoCache;
            var compURL = cache[item.id].location;
            var componentObserver
                = imipCalDAVComponentACLEntryObserver(calendar, compURL,
                                                      imipMethod);
            var obsService = Components.classes["@mozilla.org/observer-service;1"]
                .getService(Components.interfaces.nsIObserverService);
            obsService.addObserver(componentObserver,
                                   "caldav-component-acl-loaded", false);
            obsService.addObserver(componentObserver,
                                   "caldav-component-acl-reset", false);
            var compEntry = aclMgr.componentEntry(calendar.uri, compURL);
            if (compEntry.isComponentReady()) {
                obsService.removeObserver(componentObserver,
                                          "caldav-component-acl-loaded",
                                          false);
                obsService.removeObserver(componentObserver,
                                          "caldav-component-acl-reset",
                                          false);
                if (!(compEntry.userCanModify() || compEntry.userCanRespond())) {
                    proceed = false;
                    gIMIPCalendars = [calendar];
                }
            } else {
                proceed = false;
            }
        }
    }
    if (proceed) {
        gIMIPCalendars = [calendar];
        setupBar(imipMethod);
    }
}

function refreshItemCalendarCallback(calendars, data) {
    checkCalendarOwningItem(calendars[0], data.item, data.method);
}

function refreshAllCalendarsCallback(calendars, imipMethod) {
    var foundTuple = findItipItemCalendar(calendars);
    if (foundTuple) {
        var calendar = foundTuple[0];
        var item = foundTuple[1];
        checkCalendarOwningItem(calendar, item, imipMethod);
    } else {
        var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                     .getService(Components.interfaces.nsISupports)
                     .wrappedJSObject;
        var imipCalendars = [];
        for each (var cal in calendars) {
            var calEntry = aclMgr.calendarEntry(cal.uri);
            if (!calEntry.hasAccessControl
                || calEntry.userCanAddComponents()) {
                imipCalendars.push(cal);
            }
        }
        gIMIPCalendars = imipCalendars;
        setupBar(imipMethod);
    }
}

function setupIMIPCalendars(imipMethod) {
    var ready = false;

    var allCalendars = allUserCalendars();
    var foundTuple = findItipItemCalendar(allCalendars);
    if (foundTuple) {
        refreshCalendars([foundTuple[0]],
                         refreshItemCalendarCallback,
                         {item: foundTuple[1], method: imipMethod});
    } else {
        refreshCalendars(allCalendars,
                         refreshAllCalendarsCallback, imipMethod);
    }

    return ready;
}

function setupBar(imipMethod) {
    // XXX - Bug 348666 - Currently we only do REQUEST requests
    // In the future this function will set up the proper actions
    // and attributes for the buttons as based on the iMIP Method
    var imipBar = document.getElementById("imip-bar");
    imipBar.setAttribute("collapsed", "false");

    idump("setupBar. method = " + imipMethod.toUpperCase());
    if (imipMethod.toUpperCase() == "REQUEST") {
        // Check if this is an update or initial request and display things accordingly
        processRequestMsg();
    } else if (imipMethod.toUpperCase() == "REPLY") {
        // Check if this is an reply and display things accordingly
        processReplyMsg();
    } else if (imipMethod.toUpperCase() == "CANCEL") {
        // Check if this is an cancel and display things accordingly
        processCancelMsg();
    } else if (imipMethod.toUpperCase() == "PUBLISH") {
        imipBar.setAttribute("label", ltnGetString("lightning", "imipBarRequestText"));

        var button = document.getElementById("imip-button1");
        showElement(button);
        button.setAttribute("label", ltnGetString("lightning", "imipAddToCalendar.label"));
        button.setAttribute("oncommand", "setAttendeeResponse('PUBLISH', '');");
    } else {
        // Bug xxxx TBD: Something went wrong or we found a message we don't
        // support yet. We can show a "This method is not supported in this
        // version" or simply hide the iMIP bar at this point
        imipBar.setAttribute("label", ltnGetString("lightning", "imipBarUnsupportedText"));
        Components.utils.reportError("Unknown imipMethod: " + imipMethod);
    }
}

function processCancelMsg() {
    var imipBar = document.getElementById("imip-bar");
    imipBar.setAttribute("label", ltnGetString("lightning", "imipBarCancelText"));

//     var compCal = createItipCompositeCalendar();
    // Per iTIP spec (new Draft 4), multiple items in an iTIP message MUST have
    // same ID, this simplifies our searching, we can just look for Item[0].id
    var itemList = gItipItem.getItemList({});
    var onFindItemListener = {
        onOperationComplete: function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
            if (gCalItemsArrayFound.length > 0) {
                displayCancel();
            }
        },

        onGetResult: function ogr(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
            for each (var item in aItems) {
                gCalItemsArrayFound.push(aItems[0]);
            }
        }
    }
    gCalItemsArrayFound = [];
    // Search for item:
    compCal.getItem(itemList[0].id, onFindItemListener);
}

function processReplyMsg() {
    var imipBar = document.getElementById("imip-bar");
    imipBar.setAttribute("label",
                         ltnGetString("lightning", "imipBarReplyText"));

//     var compCal = createItipCompositeCalendar();
    // Per iTIP spec (new Draft 4), multiple items in an iTIP message MUST have
    // same ID, this simplifies our searching, we can just look for Item[0].id
    var itemList = gItipItem.getItemList({});
    var itipItemDate = itemList[0].stampTime;
    // check if ITIP DTSTAMP is in the future
    var nowDate = jsDateToDateTime(new Date());
    if (itipItemDate.compare(nowDate) > 0) {
        itipItemDate = nowDate;
    }

    var onFindItemListener = {
        onOperationComplete: function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
            if (gCalItemsArrayFound.length > 0) {
                displayReply();
            }
        },

        onGetResult: function ogr(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
            for each (var item in aItems) {
                if (aCalendar.getProperty("itip.disableRevisionChecks") ||
                    itipItemDate.compare(item.stampTime) > 0) {
                    gCalItemsArrayFound.push(aItems[0]);
                }
            }
        }
    };
    gCalItemsArrayFound = [];

    idump("itemList.length: " + itemList.length);
    // Search for item:
    compCal.getItem(itemList[0].id, onFindItemListener);
}

function displayCancel() {
    var button = document.getElementById("imip-button1");
    showElement(button);
    button.setAttribute("label", ltnGetString("lightning", "imipCancelInvitation.label"));
    button.setAttribute("oncommand", "deleteItemFromCancel()");
}

function displayReply() {
    var button = document.getElementById("imip-button1");
    showElement(button);
    button.setAttribute("label", ltnGetString("lightning", "imipUpdateInvitation.label"));
    button.setAttribute("oncommand", "updateItemStatusFromReply()");
}

function deleteItemFromCancel() {
    var operationListener = {
        onOperationComplete: function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
            // Call finishItipAction to set the status of the operation
            finishItipAction(aOperationType, aStatus, aDetail);
        },

        onGetResult: function ogr(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
        }
    };

    var itemArray = gItipItem.getItemList({});
    for each (var calItemFound in gCalItemsArrayFound) {
        calItemFound.calendar.deleteItem(calItemFound, operationListener);
    }

    return true;
}

function updateItemStatusFromReply() {
    var operationListener = {
        onOperationComplete: function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
            // Call finishItipAction to set the status of the operation
            finishItipAction(aOperationType, aStatus, aDetail);
        },

        onGetResult: function ogr(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
        }
    };

    // Per iTIP spec (new Draft 4), multiple items in an iTIP message MUST have
    // same ID, this simplifies our searching, we can just look for Item[0].id
    var itemArray = gItipItem.getItemList({});
    var itipItem = itemArray[0];
    for each (var calItemFound in gCalItemsArrayFound) {
        var newItem = calItemFound.clone();
        for each (var itipAttendee in itipItem.getAttendees({})) {
            var att = newItem.getAttendeeById(itipAttendee.id);
            if (att) {
                var newAtt = att.clone();
                newItem.removeAttendee(att);
                newAtt.participationStatus = itipAttendee.participationStatus;
                newItem.addAttendee(newAtt);
            }
        }
        newItem.calendar.modifyItem(newItem, calItemFound, operationListener);
    }

    return true;
}

function getMsgImipMethod() {
    return messenger.msgHdrFromURI(GetLoadedMessage()).getStringProperty("imip_method");
}

function setupMsgIdentities() {
    if (!gIdentities) {
        var acctmgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                      .getService(Components.interfaces.nsIMsgAccountManager);
        var msgURI = GetLoadedMessage();
        var msgHdr = messenger.msgHdrFromURI(msgURI);
        if (msgHdr.accountKey) {
            // First, check if the message has an account key. If so, we can use the
            // account identities to find the correct recipient
            gIdentities = acctmgr.getAccount(msgHdr.accountKey).identities;
        } else {
            // Without an account key, we have to revert back to using the server
            gIdentities = acctmgr.GetIdentitiesForServer(msgHdr.folder.server);
        }
    }
}

function getMsgRecipient() {
    var imipRecipient = "";
    var msgURI = GetLoadedMessage();
    var msgHdr = messenger.msgHdrFromURI(msgURI);
    if (!msgHdr) {
        return null;
    }

    setupMsgIdentities();
    var emailMap = {};
    if (gIdentities.Count() == 0) {
        // If we were not able to retrieve identities above, then we have no
        // choice but to revert to the default identity
        var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                .getService(Components.interfaces.nsIMsgAccountManager);
        var identity = acctMgr.defaultAccount.defaultIdentity;
        if (!identity) {
            // If there isn't a default identity (i.e Local Folders is your
            // default identity), then go ahead and use the first available
            // identity.
            var allIdentities = acctMgr.allIdentities;
            if (allIdentities.Count() > 0) {
                identity = allIdentities.GetElementAt(0)
                                        .QueryInterface(Components.interfaces.nsIMsgIdentity);
            } else {
                // If there are no identities at all, we cannot get a recipient.
                return null;
            }
        }
        emailMap[identity.email.toLowerCase()] = true;
    } else {
        // Build a map of usable email addresses
        for (var i = 0; i < gIdentities.Count(); i++) {
            var identity = gIdentities.GetElementAt(i)
                           .QueryInterface(Components.interfaces.nsIMsgIdentity);
            emailMap[identity.email.toLowerCase()] = true;
        }
    }


    var hdrParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                              .getService(Components.interfaces.nsIMsgHeaderParser);
    var emails = {};

    // First check the recipient list
    hdrParser.parseHeadersWithArray(msgHdr.recipients, emails, {}, {});
    for each (var recipient in emails.value) {
        if (emailMap[recipient.toLowerCase()]) {
            // Return the first found recipient
            return recipient;
        }
    }

    // Maybe we are in the CC list?
    hdrParser.parseHeadersWithArray(msgHdr.ccList, emails, {}, {});
    for each (var recipient in emails.value) {
        if (emailMap[recipient.toLowerCase()]) {
            // Return the first found recipient
            return recipient;
        }
    }

    // Hrmpf. Looks like delegation or maybe Bcc.
    return null;
}

// /**
//  * Call the calendar picker
//  */
// function getTargetCalendar() {
//     function filterCalendars(c) {
//         // Only consider calendars that are writable and have a transport.
//         return isCalendarWritable(c) &&
//                c.getProperty("itip.transport") != null;
//     }

//     var calendarToReturn;
//     var calendars = getCalendarManager().getCalendars({}).filter(filterCalendars);
//     // XXXNeed an error message if there is no writable calendar

//     // try to further limit down the list to those calendars that are configured to a matching attendee;
//     var item = gItipItem.getItemList({})[0];
//     var matchingCals = calendars.filter(
//         function(cal) {
//             var identity = cal.getProperty("imip.identity");
//             if (identity !== null) {
//                 identity = identity.QueryInterface(Components.interfaces.nsIMsgIdentity).email;
//                 return ((gItipItem.identity && (identity.toLowerCase() == gItipItem.identity.toLowerCase())) ||
//                         item.getAttendeeById("mailto:" + identity));
//             }
//             return false;
//         });
//     // if there's none, we will show the whole list of calendars:
//     if (matchingCals.length > 0) {
//         calendars = matchingCals;
//     }

function getTargetCalendar() {
    var calendarToReturn = null;

    if (gIMIPCalendars.length == 1) {
        // There's only one calendar, so it's silly to ask what calendar
        // the user wants to import into.
        calendarToReturn = gIMIPCalendars[0];
    } else {
        // Ask what calendar to import into
        var args = new Object();
        var aCal;
        args.gIMIPCalendars = gIMIPCalendars;
        args.onOk = function selectCalendar(aCal) { calendarToReturn = aCal; };
        args.promptText = calGetString("calendar", "importPrompt");
        openDialog("chrome://calendar/content/chooseCalendarDialog.xul",
                   "_blank", "chrome,titlebar,modal,resizable", args);
    }

    if (calendarToReturn) {
        // assure gItipItem.identity is set to the configured email address:
        var identity = calendarToReturn.getProperty("imip.identity");
        if (identity) {
            gItipItem.identity = identity.QueryInterface(Components.interfaces.nsIMsgIdentity).email;
        }
    }

    return calendarToReturn;
}

/**
 * Type is type of response
 * event_status is an optional directive to set the Event STATUS property
 */
function setAttendeeResponse(type, eventStatus) {
    if (type && gItipItem) {
        // Some methods need a target calendar. Prompt for it first.
        switch (type) {
            case "ACCEPTED":
            case "TENTATIVE":
            case "REPLY":
            case "PUBLISH":
                gItipItem.targetCalendar = getTargetCalendar();
                if (!gItipItem.targetCalendar) {
                    // The dialog was canceled, we are done.
                    return;
                }
        }

        // Now set the attendee status and perform the iTIP action. If the
        // method is not mentioned here, no further action will be taken.
        switch (type) {
            case "ACCEPTED":
            case "TENTATIVE":
            case "DECLINED": {
                var attId = null;
                var attCN = null;
                if (gItipItem.targetCalendar) {
                    var identity = gItipItem.targetCalendar.getProperty("imip.identity");
                    if (identity) { // configured email supersedes found msg recipient:
                        identity = identity.QueryInterface(Components.interfaces.nsIMsgIdentity);
                        attId = ("mailto:" + identity.email);
                        attCN = identity.fullName;
                    }
                }
                if (!attId && gItipItem.identity) {
                    attId = ("mailto:" + gItipItem.identity);
                }
                if (!attId) {
                    // Bug 420516 -- we don't support delegation yet TODO: Localize this?
                    throw new Error("setAttendeeResponse: " +
                                    "You are not on the list of invited attendees, delegation " +
                                    "is not supported yet.  See bug 420516 for details.");
                }
                for each (var item in gItipItem.getItemList({})) {
                    if (!item.getAttendeeById(attId)) { // add if not existing, e.g. on mailing list REQUEST
                        var att = Components.classes["@mozilla.org/calendar/attendee;1"]
                                            .createInstance(Components.interfaces.calIAttendee);
                        att.id = attId;
                        att.commonName = attCN;
                        item.addAttendee(att);
                    }
                }
                gItipItem.setAttendeeStatus(attId, type); // workaround for bug 351589 (fixing RSVP)
                // Fall through
            }
            case "REPLY":
            case "PUBLISH":
                doResponse(eventStatus);
                break;
        }
    }
}

/**
 * doResponse performs the iTIP action for the current ItipItem that we
 * parsed from the email.
 * @param  aLocalStatus  optional parameter to set the event STATUS property.
 *         aLocalStatus can be empty, "TENTATIVE", "CONFIRMED", or "CANCELLED"
 */
function doResponse(aLocalStatus) {
    // calIOperationListener so that we can properly return status to the
    // imip-bar
    var operationListener = {
        onOperationComplete:
        function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
            // Call finishItipAction to set the status of the operation
            finishItipAction(aOperationType, aStatus, aDetail);
        },

        onGetResult:
        function ogr(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
            // no-op
        }
    };

    // The spec is unclear if we must add all the items or if the
    // user should get to pick which item gets added.

    if (aLocalStatus != null) {
        gItipItem.localStatus = aLocalStatus;
    }

    var itipProc = Components.classes["@mozilla.org/calendar/itip-processor;1"]
                             .getService(Components.interfaces.calIItipProcessor);

    itipProc.processItipItem(gItipItem, operationListener);
}

/**
 * Bug 348666 (complete iTIP support) - This gives the user an indication
 * that the Action occurred.
 *
 * In the future, this will store the status of the invitation in the
 * invitation manager.  This will enable us to provide the ability to request
 * updates from the organizer and to suggest changes to invitations.
 *
 * Currently, this is called from our calIOperationListener that is sent to
 * the ItipProcessor. This conveys the status of the local iTIP processing
 * on your calendar. It does not convey the success or failure of sending a
 * response to the ItipItem.
 */
function finishItipAction(aOperationType, aStatus, aDetail) {
    // For now, we just state the status for the user something very simple
    var imipBar = document.getElementById("imip-bar");
    if (Components.isSuccessCode(aStatus)) {
        if (aOperationType == Components.interfaces.calIOperationListener.ADD) {
            imipBar.setAttribute("label", ltnGetString("lightning", "imipAddedItemToCal"));
        } else if (aOperationType == Components.interfaces.calIOperationListener.MODIFY) {
            imipBar.setAttribute("label", ltnGetString("lightning", "imipUpdatedItem"));
        } else if (aOperationType == Components.interfaces.calIOperationListener.DELETE) {
            imipBar.setAttribute("label", ltnGetString("lightning", "imipCanceledItem"));
        }

        hideElement("imip-button1");
        hideElement("imip-button2");
        hideElement("imip-button3");
    } else {
        // Bug 348666: When we handle more iTIP methods, we need to create
        // more sophisticated error handling.
        // TODO L10N localize
        imipBar.setAttribute("collapsed", "true");
        var msg = "Invitation could not be processed. Status: " + aStatus;
        if (aDetail) {
            msg += "\nDetails: " + aDetail;
        }
        showError(msg);
    }
}

/**
 * Walks through the list of events in the iTipItem and discovers whether or not
 * these events already exist on a calendar. Calls displayRequestMethod.
 */
function processRequestMsg() {
    // According to the specification, we have to determine if the event ID
    // already exists on the calendar of the user - that means we have to search
    // them all. :-(
    var existingItemSequence = -1;

    idump("processRequestMsg");
//     var compCal = createItipCompositeCalendar();

    // Per iTIP spec (new Draft 4), multiple items in an iTIP message MUST have
    // same ID, this simplifies our searching, we can just look for Item[0].id
    var itemList = gItipItem.getItemList({ });
    var newSequence = itemList[0].getProperty("SEQUENCE");

    // Make sure we don't have a pre Outlook 2007 appointment, but if we do
    // use Microsoft's Sequence number. I <3 MS
    if ((newSequence == "0") &&
        itemList[0].hasProperty("X-MICROSOFT-CDO-APPT-SEQUENCE")) {
        newSequence = itemList[0].getProperty("X-MICROSOFT-CDO-APPT-SEQUENCE");
    }

    var onFindItemListener = {
        onOperationComplete:
        function ooc(aCalendar, aStatus, aOperationType, aId, aDetail) {
            idump("onOperationComplete");
        },

        onGetResult:
        function ogr(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
            idump("onGetResult");
            if (aCount && aItems[0] && !this.processedId) {
                idump("  blabla");
                this.processedId = true;
                var existingSequence = aItems[0].getProperty("SEQUENCE");

                // Handle the microsoftism foolishness
                if ((existingSequence == "0") &&
                    itemList[0].hasProperty("X-MICROSOFT-CDO-APPT-SEQUENCE")) {
                    existingSequence = aItems[0].getProperty("X-MICROSOFT-CDO-APPT-SEQUENCE");
                }

                if (aCalendar.getProperty("itip.disableRevisionChecks")) {
                    displayRequestMethod(1, 0); // force to be an update
                } else {
                    displayRequestMethod(newSequence, existingSequence);
                }
            }
        }
    };

    if (gIMIPCalendars.length > 0) {
        // Search
        for each (var cal in gIMIPCalendars) {
            cal.getItem(itemList[0].id, onFindItemListener);
        }
        if (!onFindItemListener.processedId) {
            displayRequestMethod(newSequence, -1);
        }
    } else {
        displayRequestMethod(0, 1);
    }
}

function displayRequestMethod(newItemSequence, existingItemSequence) {
    idump("displayRequestMethod (" + newItemSequence
          + ", " + existingItemSequence + ")");
    idump(STACK(50));
    // Three states here:
    // 0 = the new event does not exist on the calendar (therefore, this is an add)
    //     (Item does not exist yet: existingItemSequence == -1)
    // 1 = the event does exist and contains a proper update (this is an update)
    //     (Item has been updated: newSequence > existingSequence)
    // 2 = the event clicked on is an old update and should NOT be applied
    //     (Item is an old message that has already been added/updated: new <= existing)
    var updateValue = 0;

    if (existingItemSequence == -1) {
        updateValue = 0;
    } else if (newItemSequence > existingItemSequence) {
        updateValue = 1;
    } else {
        updateValue = 2;
    }

    idump("updateValue: " + updateValue );
    // now display the proper message for this update type:

    var imipBar = document.getElementById("imip-bar");
    if (updateValue) {
        // This is a message updating existing event(s). But updateValue could
        // indicate that this update has already been applied, check that first.
        if (updateValue == 2) {
            // This case, they clicked on an old message that has already been
            // added/updated, we want to tell them that.
            imipBar.setAttribute("label", ltnGetString("lightning", "imipBarAlreadyAddedText"));

            hideElement("imip-button1");
            hideElement("imip-button2");
            hideElement("imip-button3");
        } else {
            // Legitimate update, let's offer the update path
            imipBar.setAttribute("label", ltnGetString("lightning", "imipBarUpdateText"));

            var button = document.getElementById("imip-button1");
            showElement(button);
            button.setAttribute("label", ltnGetString("lightning", "imipUpdateInvitation.label"));
            button.setAttribute("oncommand", "setAttendeeResponse('ACCEPTED', 'CONFIRMED');");

            // Create a DECLINE button (user chooses not to attend the updated event)
            button = document.getElementById("imip-button2");
            showElement(button);
            button.setAttribute("label", ltnGetString("lightning", "imipDeclineInvitation.label"));
            button.setAttribute("oncommand", "setAttendeeResponse('DECLINED', 'CONFIRMED');");

            // Create a ACCEPT TENTATIVE button
            button = document.getElementById("imip-button3");
            showElement(button);
            button.setAttribute("label", ltnGetString("lightning", "imipAcceptTentativeInvitation.label"));
            button.setAttribute("oncommand", "setAttendeeResponse('TENTATIVE', 'CONFIRMED');");
        }
    } else {
        imipBar.setAttribute("label", ltnGetString("lightning", "imipBarRequestText"));

        var button = document.getElementById("imip-button1");
        showElement(button);
        button.setAttribute("label", ltnGetString("lightning", "imipAcceptInvitation.label"));
        button.setAttribute("oncommand", "setAttendeeResponse('ACCEPTED', 'CONFIRMED');");

        // Create a DECLINE button
        button = document.getElementById("imip-button2");
        showElement(button);
        button.setAttribute("label", ltnGetString("lightning", "imipDeclineInvitation.label"));
        button.setAttribute("oncommand", "setAttendeeResponse('DECLINED', 'CONFIRMED');");

        // Create a ACCEPT TENTATIVE button
        button = document.getElementById("imip-button3");
        showElement(button);
        button.setAttribute("label", ltnGetString("lightning", "imipAcceptTentativeInvitation.label"));
        button.setAttribute("oncommand", "setAttendeeResponse('TENTATIVE', 'CONFIRMED');");
    }
}
