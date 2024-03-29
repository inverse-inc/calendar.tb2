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
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

function calFreeBusyListener(numOperations, finalListener) {
    this.mFinalListener = finalListener;
    this.mNumOperations = numOperations;

    var this_ = this;
    function cancelFunc() { // operation group has been cancelled
        this_.notifyResult(null);
    }
    this.opGroup = new calOperationGroup(cancelFunc);
}
calFreeBusyListener.prototype = {
    mFinalListener: null,
    mNumOperations: 0,
    opGroup: null,

    notifyResult: function calFreeBusyListener_notifyResult(result) {
        var listener = this.mFinalListener;
        if (listener) {
            if (!this.opGroup.isPending) {
                this.mFinalListener = null;
            }
            listener.onResult(this.opGroup, result);
        }
    },

    // calIGenericOperationListener:
    onResult: function calFreeBusyListener_onResult(aOperation, aResult) {
        if (this.mFinalListener) {
            if (!aOperation || !aOperation.isPending) {
                --this.mNumOperations;
                if (this.mNumOperations == 0) {
                    this.opGroup.notifyCompleted();
                }
            }
            this.notifyResult(aResult);
        }
    }
};

function calFreeBusyService() {
    this.wrappedJSObject = this;
    this.mProviders = new calInterfaceBag(Components.interfaces.calIFreeBusyProvider);
}
calFreeBusyService.prototype = {
    mProviders: null,

    QueryInterface: function calFreeBusyService_QueryInterface(aIID) {
        return doQueryInterface(this, calFreeBusyService.prototype, aIID, null, this);
    },

    // nsIClassInfo:
    getInterfaces: function calFreeBusyService_getInterfaces(count) {
        const ifaces = [Components.interfaces.nsISupports,
                        Components.interfaces.calIFreeBusyProvider,
                        Components.interfaces.calIFreeBusyService,
                        Components.interfaces.nsIClassInfo];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function calFreeBusyService_getHelperForLanguage(language) {
        return null;
    },
    contractID: "@mozilla.org/calendar/freebusy-service;1",
    classDescription: "Calendar FreeBusy Service",
    classID: Components.ID("{29C56CD5-D36E-453a-ACDE-0083BD4FE6D3}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    // calIFreeBusyProvider:
    getFreeBusyIntervals: function calFreeBusyService_getFreeBusyIntervals(aCalId,
                                                                           aRangeStart,
                                                                           aRangeEnd,
                                                                           aBusyTypes,
                                                                           aListener) {
        var groupListener = new calFreeBusyListener(this.mProviders.size, aListener);
        function getFreeBusyIntervals_(provider) {
            try {
                groupListener.opGroup.add(provider.getFreeBusyIntervals(aCalId,
                                                                        aRangeStart,
                                                                        aRangeEnd,
                                                                        aBusyTypes,
                                                                        groupListener));
            } catch (exc) {
                Components.utils.reportError(exc);
                groupListener.onResult(null, []); // dummy to adopt mNumOperations
            }
        }
        this.mProviders.forEach(getFreeBusyIntervals_);
        return groupListener.opGroup;
    },

    // calIFreeBusyService:
    addProvider: function calFreeBusyListener_addProvider(aProvider) {
        this.mProviders.add(aProvider);
    },
    removeProvider: function calFreeBusyListener_removeProvider(aProvider) {
        this.mProviders.remove(aProvider);
    }
};
