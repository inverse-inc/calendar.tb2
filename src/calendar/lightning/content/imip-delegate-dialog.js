/* -*- Mode: java; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/****** BEGIN LICENSE BLOCK *****
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
 * Copyright (C) 2009 Inverse inc. All Rights Reserved.
 *
 * Contributor(s):
 *   Wolfgang Sourdeau  <wsourdeau@inverse.ca>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the LGPL or the GPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 ****** END LICENSE BLOCK ***** */

function doOK() {
    var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                 .getService(Components.interfaces.nsIMsgHeaderParser);

    var emailAddresses = {};
    var names = {};

    var delegateField = document.getElementById("item-delegate");
    headerParser.parseHeadersWithArray(delegateField.value,
                                       emailAddresses, names,
                                       {});
    var newAttendee = null;
    if (emailAddresses.value.length > 0) {
        newAttendee = Components.classes["@mozilla.org/calendar/attendee;1"]
                                .createInstance(Components.interfaces.calIAttendee);
        newAttendee.isOrganizer = false;
        newAttendee.id = "mailto:" + emailAddresses.value[0];
        if (names.value[0].length > 0
            && names.value[0] != emailAddresses.value[0]) {
            newAttendee.commonName = names.value[0];
        }
    }

    var stayTunedCB = document.getElementById("item-delegate-staytuned");
    window.arguments[0].onOk(newAttendee, stayTunedCB.checked);
}

function onLoad() {
    var prompt = document.getElementById("prompt");
    prompt.value = window.arguments[0].promptText;
}
