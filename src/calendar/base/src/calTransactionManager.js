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
 * The Original Code is Calendar Transaction Manager code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch (mozilla@kewis.ch)
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp Kewisch <mozilla@kewis.ch>
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

function calTransactionManager() {
    if (!this.transactionManager) {
        this.transactionManager =
            Components.classes["@mozilla.org/transactionmanager;1"]
                      .createInstance(Components.interfaces.nsITransactionManager);
    }
}

calTransactionManager.prototype = {

    QueryInterface: function cTM_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.calITransactionManager))
        {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },

    transactionManager: null,

    createAndCommitTxn: function cTM_createAndCommitTxn(aAction,
                                                        aItem,
                                                        aCalendar,
                                                        aOldItem,
                                                        aListener) {
        var txn = new calTransaction(aAction,
                                     aItem,
                                     aCalendar,
                                     aOldItem,
                                     aListener);
        this.transactionManager.doTransaction(txn);
    },

    beginBatch: function cTM_beginBatch() {
        this.transactionManager.beginBatch();
    },

    endBatch: function cTM_endBatch() {
        this.transactionManager.endBatch();
    },

    checkWritable: function cTM_checkWritable(transaction) {
        if (transaction) {
            transaction = transaction.wrappedJSObject;
            if (transaction) {
                function checkItem(item) {
                    if (item) {
                        var cal = item.calendar;
                        if (cal && !isCalendarWritable(cal)) {
                            return false;
                        }
                    }
                    return true;
                }

                if (!checkItem(transaction.mItem) ||
                    !checkItem(transaction.mOldItem)) {
                    return false;
                }
            }
        }
        return true;
    },

    undo: function cTM_undo() {
        this.transactionManager.undoTransaction();
    },

    canUndo: function cTM_canUndo() {
        return ((this.transactionManager.numberOfUndoItems > 0) &&
                this.checkWritable(this.transactionManager.peekUndoStack()));
    },

    redo: function cTM_redo() {
        this.transactionManager.redoTransaction();
    },

    canRedo: function cTM_canRedo() {
        return ((this.transactionManager.numberOfRedoItems > 0) &&
                this.checkWritable(this.transactionManager.peekRedoStack()));
    }
};

function calTransaction(aAction, aItem, aCalendar, aOldItem, aListener) {
    this.wrappedJSObject = this;
    this.mAction = aAction;
    this.mItem = aItem;
    this.mCalendar = aCalendar;
    this.mOldItem = aOldItem;
    this.mListener = aListener;
}

calTransaction.prototype = {

    mAction: null,
    mCalendar: null,
    mItem: null,
    mOldItem: null,
    mOldCalendar: null,
    mListener: null,
    mIsDoTransaction: false,

    QueryInterface: function cT_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.nsITransaction) &&
            !aIID.equals(Components.interfaces.calIOperationListener))
        {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },

    onOperationComplete: function cT_onOperationComplete(aCalendar,
                                                         aStatus,
                                                         aOperationType,
                                                         aId,
                                                         aDetail) {
        if (aStatus == Components.results.NS_OK &&
            (aOperationType == Components.interfaces.calIOperationListener.ADD ||
             aOperationType == Components.interfaces.calIOperationListener.MODIFY)) {
            if (this.mIsDoTransaction) {
                this.mItem = aDetail;
            } else {
                this.mOldItem = aDetail;
            }
        }
        if (this.mListener) {
            this.mListener.onOperationComplete(aCalendar,
                                               aStatus,
                                               aOperationType,
                                               aId,
                                               aDetail);
        }
    },

    onGetResult: function cT_onGetResult(aCalendar,
                                         aStatus,
                                         aItemType,
                                         aDetail,
                                         aCount,
                                         aItems) {
        if (this.mListener) {
            this.mListener.onGetResult(aCalendar,
                                       aStatus,
                                       aItemType,
                                       aDetail,
                                       aCount,
                                       aItems);
        }
    },

    // Added, which could be useful for bug #457203 -  iTIP overhaul. It'll
    // correctly reset the participation status of attendees when there's
    // a major change (ie., SEQUENCE update to the event) or when we create
    // an exception to a recurring event.
    //
    // Also see the code in calendar-item-editing.js - especially for the
    // ratinale on the organizer.
    //
    resetAttendeesStatus: function cal_itip_resetAttendeesStatus(aItem) {
        var att = aItem.getAttendees({});
        aItem.removeAllAttendees();
        for each (var attendee in att) {
            attendee = attendee.clone();
            if ((aItem.organizer && (attendee.id.toLowerCase()
                != aItem.organizer.id.toLowerCase()))
                && attendee.participationStatus != "DELEGATED"
                && attendee.role != "NON-PARTICIPANT") {
                attendee.participationStatus = "NEEDS-ACTION";
                attendee.rsvp = true;
            }
            aItem.addAttendee(attendee);
        }
    },

    // Stolen from bug #457203 -  iTIP overhaul
    prepareSequence: function cal_itip_prepareSequence(newItem, oldItem) {
      //if (oldItem.calendar.isInvitation(newItem)) {
      //      return newItem; // invitation copies don't bump the SEQUENCE
      //  }

        if (newItem.recurrenceId && !oldItem.recurrenceId && oldItem.recurrenceInfo) {
            // XXX todo: there's still the bug that modifyItem is called with mixed occurrence/parent,
            //           find original occurrence
            oldItem = oldItem.recurrenceInfo.getOccurrenceFor(newItem.recurrenceId);
            NS_ASSERT(oldItem, "unexpected!");
            if (!oldItem) {
                return newItem;
            }
        }
        function hashFromProps(aItem, props) {
            var propStrings = [];
            
            function addProps(item) {
                if (item) {
                    propHash = {};
                    for each (var prop in props) {
                        propHash[prop] = true;
                    }
                    calIterateIcalComponent(
                                            item.icalComponent,
                                            function(subComp) {
                                                for (var prop = subComp.getFirstProperty("ANY");
                                                     prop;
                                                     prop = subComp.getNextProperty("ANY")) {
                                                    if (propHash[prop.propertyName]) {
                                                        propStrings.push(item.recurrenceId + "#" + prop.icalString);
                                                    }
                                                }
                                            });
                }
            }


            addProps(aItem, props);
            var rec = (aItem && aItem.recurrenceInfo);
            if (rec) {
                rec.getExceptionIds({}).forEach(
                    function(rid) {
                        addProps(rec.getExceptionFor(rid, false), props);
                    });
            }
            propStrings.sort();
            return propStrings.join("");
        }

        const seqProps = [ "DTSTART", "DTEND", "DURATION", "DUE", "RDATE",
                           "RRULE", "EXDATE", "STATUS", "LOCATION" ];
        var h1 = hashFromProps(newItem, seqProps);
        var h2 = hashFromProps(oldItem, seqProps);
        if (h1 != h2) {
            newItem = newItem.clone();
            // bump SEQUENCE, it never decreases (mind undo scenario here)
            newItem.setProperty("SEQUENCE",
                                String(Math.max(oldItem.getProperty("SEQUENCE"),
                                                newItem.getProperty("SEQUENCE"))+ 1));

            const partStatProps = [ "DTSTART", "DTEND", "DURATION", "DUE",
                                    "RRULE", "LOCATION" ];
            h1 = hashFromProps(newItem, partStatProps);
            h2 = hashFromProps(oldItem, partStatProps);
            if (h1 != h2) {
                this.resetAttendeesStatus(newItem);
            }
        }

        return newItem;
    },

    doTransaction: function cT_doTransaction() {
        this.mIsDoTransaction = true;
        switch (this.mAction) {
            case 'add':
                this.mCalendar.addItem(this.mItem, this);
                break;
            case 'modify':
                if (this.mItem.calendar.id != this.mOldItem.calendar.id) {
                    this.mOldCalendar = this.mOldItem.calendar;
                    this.mOldCalendar.deleteItem(this.mOldItem, this);
                    this.mCalendar.addItem(this.mItem, this);
                } else {
		     this.mCalendar.modifyItem(this.prepareSequence(this.mItem, this.mOldItem),
					      this.mOldItem,
                                              this);
                }
                break;
            case 'delete':
                this.mCalendar.deleteItem(this.mItem, this);
                break;
            default:
                throw new Components.Exception("Invalid action specified",
                                               Components.results.NS_ERROR_ILLEGAL_VALUE);
                break;
        }
    },
    
    undoTransaction: function cT_undoTransaction() {
        this.mIsDoTransaction = false;
        switch (this.mAction) {
            case 'add':
                this.mCalendar.deleteItem(this.mItem, this);
                break;
            case 'modify':
                if (this.mOldItem.calendar.id != this.mItem.calendar.id) {
                    this.mCalendar.deleteItem(this.mItem, this);
                    this.mOldCalendar.addItem(this.mOldItem, this);
                } else {
                    this.mCalendar.modifyItem(this.mOldItem, this.mItem, this);
                }
                break;
            case 'delete':
                this.mCalendar.addItem(this.mItem, this);
                break;
            default:
                throw new Components.Exception("Invalid action specified",
                                               Components.results.NS_ERROR_ILLEGAL_VALUE);
                break;
        }
    },
    
    redoTransaction: function cT_redoTransaction() {
        this.doTransaction();
    },

    isTransient: false,

    merge: function cT_merge(aTransaction) {
        // No support for merging
        return false;
    }
};
