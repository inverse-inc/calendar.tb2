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

var gStartDate = null;
var gEndDate = null;
var gStartTimezone = null;
var gEndTimezone = null;
var gDuration = null;
var gStartHour = 0;
var gEndHour = 24;
var gIsReadOnly = false;
var gIsInvitation = false;
var gIgnoreUpdate = false;
var gDisplayTimezone = true;
var gUndoStack = [];
var gForce24Hours = false;
var gZoomFactor = 100;

function onLoad() {
    // first of all, attach all event handlers
    window.addEventListener("resize", onResize, true);
    window.addEventListener("modify", onModify, true);
    window.addEventListener("rowchange", onRowChange, true);
    window.addEventListener("DOMMouseScroll", onMouseScroll, true);
    window.addEventListener("DOMAttrModified", onAttrModified, true);
    window.addEventListener("timebar", onTimebar, true);
    window.addEventListener("timechange", onTimeChange, true);

    var args = window.arguments[0];
    var startTime = args.startTime;
    var endTime = args.endTime;
    var calendar = args.calendar;

    gDisplayTimezone = args.displayTimezone;

    onChangeCalendar(calendar);

    // we need to enforce several layout constraints which can't be modelled
    // with plain xul and css, at least as far as i know.
    const kStylesheet = "chrome://calendar/content/sun-calendar-event-dialog.css";
    for each (var stylesheet in document.styleSheets) {
        if (stylesheet.href == kStylesheet) {
            // make the dummy-spacer #1 [top] the same height as the timebar
            var timebar = document.getElementById("timebar");
            stylesheet.insertRule(
                ".attendee-spacer-top { height: "
                    + timebar.boxObject.height+"px; }", 0);
            // make the dummy-spacer #2 [bottom] the same height as the scrollbar
            var scrollbar = document.getElementById("horizontal-scrollbar");
            stylesheet.insertRule(
                ".attendee-spacer-bottom { height: "
                    + scrollbar.boxObject.height+"px; }", 0);
            break;
        }
    }

    var zoom = document.getElementById("zoom-menulist");
    var zoomOut = document.getElementById("zoom-out-button");
    var zoomIn = document.getElementById("zoom-in-button");

    var pb2 = Components.classes["@mozilla.org/preferences-service;1"].
              getService(Components.interfaces.nsIPrefBranch2);
    try {
        zoom.value = pb2.getCharPref("calendar.invitations.freebuzy.zoom");
    }
    catch(e) {
        zoom.value = "50";
    }

    var containers = [ "attendees-container", "freebusy-container" ];
    for each (var container in containers) {
        try {
            var width = pb2.getCharPref("calendar.invitations."
                                        + container + ".width");
            var container = document.getElementById(container);
            container.width = width + "px";
        }
        catch(e) {}
    }

    initTimeRange();

    // Check if an all-day event has been passed in (to adapt endDate).
    if (startTime.isDate) {
        startTime = startTime.clone();
        endTime = endTime.clone();

        endTime.day--;

        // for all-day events we expand to 24hrs, set zoom-factor to 25%
        // and disable the zoom-control.
        setForce24Hours(true);
        zoom.value = "400";
        zoom.setAttribute("disabled", "true");
        zoomOut.setAttribute("disabled", "true");
        zoomIn.setAttribute("disabled", "true");
    }

    setZoomFactor(zoom.value);

    loadDateTime(startTime, endTime);
    propagateDateTime();

    updateButtons();

    // attach an observer to get notified of changes
    // that are relevant to this dialog.
    var prefObserver = {
        observe: function aD_observe(aSubject, aTopic, aPrefName) {
            switch (aPrefName) {
                case "calendar.view.daystarthour":
                case "calendar.view.dayendhour":
                    initTimeRange();
                    propagateDateTime();
                    break;
            }
        }
    };
    pb2.addObserver("calendar.", prefObserver, false);
    window.addEventListener("unload",
        function() {
            pb2.removeObserver("calendar.", prefObserver);
            saveWidgets(pb2);
        },
        false);

    opener.setCursor("auto");
    self.focus();
}

function saveWidgets(pb2) {
    var zoom = document.getElementById("zoom-menulist");
    pb2.setCharPref("calendar.invitations.freebuzy.zoom", zoom.value);

    var container = document.getElementById("attendees-container");
    pb2.setCharPref("calendar.invitations.attendees-container.width",
                    container.boxObject.width);
    container = document.getElementById("freebusy-container");
    pb2.setCharPref("calendar.invitations.freebusy-container.width",
                    container.boxObject.width);
}

function onAccept() {
    var rc;

    if (window.hasCheckedConflicts) {
        rc = true;
    }
    else {
        rc = false;
        var attendeesList = document.getElementById("attendees-list");
        var listener = {
          onRequestComplete: function(aCanClose) {
              if (aCanClose
                  || window.confirm(calGetString("sun-calendar-event-dialog",
                                                 "confirmTimeConflict"))) {
                  window.hasCheckedConflicts = true;
                  window.arguments[0].onOk(attendeesList.attendees,
                                           attendeesList.organizer,
                                           gStartDate.getInTimezone(gStartTimezone),
                                           gEndDate.getInTimezone(gEndTimezone));

                  var dialog = document.getElementById("sun-calendar-event-dialog-attendees");
                  dialog.acceptDialog();
              }
          }
        };

        var startDate = document.getElementById("event-starttime").value;
        var endDate = document.getElementById("event-endtime").value;

        var cHandler = new conflictHandler(attendeesList.attendees,
                                           startDate, endDate,
                                           listener);
        cHandler.start();
    }

    return rc;
}

function onCancel() {
    return true;
}

function onZoomFactor(aValue) {
    setZoomFactor(parseInt(aValue));
}


/**
 * Function called when zoom buttons (+/-) are clicked.
 *
 * @param aZoomOut      true -> zoom out; false -> zoom in.
 */
function zoomWithButtons(aZoomOut) {
    var zoom = document.getElementById("zoom-menulist");
    if (aZoomOut && zoom.selectedIndex < 4) {
        zoom.selectedIndex++;
    } else if (!aZoomOut && zoom.selectedIndex > 0) {
        zoom.selectedIndex--;
    }
    setZoomFactor(parseInt(zoom.value));
}

function loadDateTime(aStartDate, aEndDate) {
    gDuration = aEndDate.subtractDate(aStartDate);
    var kDefaultTimezone = calendarDefaultTimezone();
    gStartTimezone = aStartDate.timezone;
    gEndTimezone = aEndDate.timezone;
    gStartDate = aStartDate.getInTimezone(kDefaultTimezone);
    gEndDate = aEndDate.getInTimezone(kDefaultTimezone);
    gStartDate.makeImmutable();
    gEndDate.makeImmutable();
}

function propagateDateTime() {
    // Fill the controls
    updateDateTime();

    // Tell the timebar about the new start/enddate
    var timebar = document.getElementById("timebar");
    timebar.startDate = gStartDate;
    timebar.endDate = gEndDate;
    timebar.refresh();

    // Tell the selection-bar about the new start/enddate
    var selectionbar = document.getElementById("selection-bar");
    selectionbar.startDate = gStartDate;
    selectionbar.endDate = gEndDate;
    selectionbar.update();

    // Tell the freebusy grid about the new start/enddate
    var grid = document.getElementById("freebusy-grid");

    var refresh = (grid.startDate == null) ||
                  (grid.startDate.compare(gStartDate) != 0) ||
                  (grid.endDate == null) ||
                  (grid.endDate.compare(gEndDate) != 0);
    grid.startDate = gStartDate;
    grid.endDate = gEndDate;
    if (refresh) {
        grid.forceRefresh();
    }

    // Expand to 24hrs if the new range is outside of the default range.
    var kDefaultTimezone = calendarDefaultTimezone();
    var startTime = gStartDate.getInTimezone(kDefaultTimezone);
    var endTime = gEndDate.getInTimezone(kDefaultTimezone);
    if ((startTime.hour < gStartHour) ||
        (endTime.hour > gEndHour) ||
        (startTime.isDate)) {
        setForce24Hours(true);
    }
}

/**
 * assumes that gStartDate and gEndDate have been correctly initialized,
 * either by having called loadDateTime() or having read the information
 * from the controls due to recent user input. gStartDate and gEndDate are
 * assumed to always be in the default timezone while the actual timezones
 * are expected at gStartTimezone and gEndTimezone. this function attempts
 * to copy these state related informations to the dialog controls, which
 * makes it read from the variables and write to the controls (i.e. it
 * doesn't change the state).
 */
function updateDateTime() {
    // Convert to default timezone if the timezone option
    // is *not* checked, otherwise keep the specific timezone
    // and display the labels in order to modify the timezone.
    if (gDisplayTimezone) {
        var startTime = gStartDate.getInTimezone(gStartTimezone);
        var endTime = gEndDate.getInTimezone(gEndTimezone);

        if (startTime.isDate) {
            document.getElementById("all-day")
                .setAttribute("checked", "true");
        }

        // In the case where the timezones are different but
        // the timezone of the endtime is "UTC", we convert
        // the endtime into the timezone of the starttime.
        if (startTime && endTime) {
            if (!compareObjects(startTime.timezone, endTime.timezone)) {
                if (endTime.timezone.isUTC) {
                    endTime = endTime.getInTimezone(startTime.timezone);
                }
            }
        }

        // Before feeding the date/time value into the control we need
        // to set the timezone to 'floating' in order to avoid the
        // automatic conversion back into the OS timezone.
        startTime.timezone = floating();
        endTime.timezone = floating();

        document.getElementById("event-starttime").value = startTime.jsDate;
        document.getElementById("event-endtime").value = endTime.jsDate;
    } else {
        var kDefaultTimezone = calendarDefaultTimezone();

        var startTime = gStartDate.getInTimezone(kDefaultTimezone);
        var endTime = gEndDate.getInTimezone(kDefaultTimezone);

        if (startTime.isDate) {
            document.getElementById("all-day")
                .setAttribute("checked", "true");
        }

        // Before feeding the date/time value into the control we need
        // to set the timezone to 'floating' in order to avoid the
        // automatic conversion back into the OS timezone.
        startTime.timezone = floating();
        endTime.timezone = floating();

        document.getElementById("event-starttime").value = startTime.jsDate;
        document.getElementById("event-endtime").value = endTime.jsDate;
    }

    updateTimezone();
    updateAllDay();
}

/**
 * assumes that gStartDate and gEndDate have been correctly initialized,
 * either by having called loadDateTime() or having read the information
 * from the controls due to recent user input. gStartDate and gEndDate are
 * assumed to always be in the default timezone while the actual timezones
 * are expected at gStartTimezone and gEndTimezone. this function attempts
 * to copy these state related informations to the dialog controls, which
 * makes it read from the variables and write to the controls (i.e. it
 * doesn't change the state).
 */
function updateTimezone() {
    gIgnoreUpdate = true;

    if (gDisplayTimezone) {
        var startTimezone = gStartTimezone;
        var endTimezone = gEndTimezone;
        var equalTimezones = false;
        if (startTimezone && endTimezone &&
            (compareObjects(startTimezone, endTimezone) || endTimezone.isUTC)) {
            equalTimezones = true;
        }

        var tzStart = document.getElementById("timezone-starttime");
        var tzEnd = document.getElementById("timezone-endtime");
        if (startTimezone != null) {
            tzStart.removeAttribute('collapsed');
            tzStart.value = startTimezone.displayName || startTimezone.tzid;
        } else {
            tzStart.setAttribute('collapsed', 'true');
        }

        // we never display the second timezone if both are equal
        if (endTimezone != null && !equalTimezones) {
            tzEnd.removeAttribute('collapsed');
            tzEnd.value = endTimezone.displayName || endTimezone.tzid;
        } else {
            tzEnd.setAttribute('collapsed', 'true');
        }
    } else {
        document.getElementById("timezone-starttime")
            .setAttribute('collapsed', 'true');
        document.getElementById("timezone-endtime")
            .setAttribute('collapsed', 'true');
    }

    gIgnoreUpdate = false;
}

function updateStartTime() {
    if (gIgnoreUpdate) {
        return;
    }

    var startWidgetId = "event-starttime";
    var endWidgetId = "event-endtime";

    var startWidget = document.getElementById(startWidgetId);
    var endWidget = document.getElementById(endWidgetId);

    // jsDate is always in OS timezone, thus we create a calIDateTime
    // object from the jsDate representation and simply set the new
    // timezone instead of converting.
    var start = jsDateToDateTime(startWidget.value,
                                 gDisplayTimezone ? gStartTimezone : calendarDefaultTimezone());
    gStartDate = start.clone();
    start.addDuration(gDuration);
    gEndDate = start.getInTimezone(gEndTimezone);

    var allDayElement = document.getElementById("all-day");
    var allDay = allDayElement.getAttribute("checked") == "true";
    if (allDay) {
        gStartDate.isDate = true;
        gEndDate.isDate = true;
    }

    propagateDateTime();
}

function updateEndTime() {
    if (gIgnoreUpdate) {
        return;
    }

    var startWidgetId = "event-starttime";
    var endWidgetId = "event-endtime";

    var startWidget = document.getElementById(startWidgetId);
    var endWidget = document.getElementById(endWidgetId);

    var saveStartTime = gStartDate;
    var saveEndTime = gEndDate;
    var kDefaultTimezone = calendarDefaultTimezone();

    gStartDate = jsDateToDateTime(startWidget.value,
                                  gDisplayTimezone ? gStartTimezone : calendarDefaultTimezone());

    var timezone = gEndTimezone;
    if (timezone.isUTC &&
        gStartDate &&
        !compareObjects(gStartTimezone, gEndTimezone)) {
        timezone = gStartTimezone;
    }
    gEndDate = jsDateToDateTime(endWidget.value,
                                gDisplayTimezone ? timezone : kDefaultTimezone);

    var allDayElement = document.getElementById("all-day");
    var allDay = allDayElement.getAttribute("checked") == "true";
    if (allDay) {
        gStartDate.isDate = true;
        gEndDate.isDate = true;
    }

    // Calculate the new duration of start/end-time.
    // don't allow for negative durations.
    var warning = false;
    if (gEndDate.compare(gStartDate) >= 0) {
        gDuration = gEndDate.subtractDate(gStartDate);
    } else {
        gStartDate = saveStartTime;
        gEndDate = saveEndTime;
        warning = true;
    }

    propagateDateTime();

    if (warning) {
        var callback = function() {
            var promptService =
                Components.classes[
                    "@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(
                        Components.interfaces.nsIPromptService);
            promptService.alert(
                null,
                document.title,
                calGetString("calendar", "warningNegativeDuration"));
        }
        setTimeout(callback, 1);
    }
}

function editStartTimezone() {
    var tzStart = document.getElementById("timezone-starttime");
    if (tzStart.hasAttribute("disabled")) {
        return;
    }

    var self = this;
    var args = new Object();
    args.time = gStartDate.getInTimezone(gStartTimezone);
    args.onOk = function(datetime) {
        var equalTimezones = false;
        if (gStartTimezone && gEndTimezone &&
            compareObjects(gStartTimezone, gEndTimezone)) {
            equalTimezones = true;
        }
        gStartTimezone = datetime.timezone;
        if (equalTimezones) {
            gEndTimezone = datetime.timezone;
        }
        self.propagateDateTime();
    };

    // Open the dialog modally
    openDialog(
        "chrome://calendar/content/sun-calendar-event-dialog-timezone.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

function editEndTimezone() {
    var tzStart = document.getElementById("timezone-endtime");
    if (tzStart.hasAttribute("disabled")) {
        return;
    }

    var self = this;
    var args = new Object();
    args.time = gEndTime.getInTimezone(gEndTimezone);
    args.onOk = function(datetime) {
        if (gStartTimezone && gEndTimezone &&
            compareObjects(gStartTimezone, gEndTimezone)) {
            gStartTimezone = datetime.timezone;
        }
        gEndTimezone = datetime.timezone;
        self.propagateDateTime();
    };

    // Open the dialog modally
    openDialog(
        "chrome://calendar/content/sun-calendar-event-dialog-timezone.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

function updateAllDay() {
    if (gIgnoreUpdate) {
        return;
    }

    var allDayElement = document.getElementById("all-day");
    var allDay  = (allDayElement.getAttribute("checked") == "true");
    var startpicker = document.getElementById("event-starttime");
    var endpicker = document.getElementById("event-endtime");

    var tzStart = document.getElementById("timezone-starttime");
    var tzEnd = document.getElementById("timezone-endtime");

    // Disable the timezone links if 'allday' is checked OR the
    // calendar of this item is read-only. In any other case we
    // enable the links.
    if (allDay) {
        startpicker.setAttribute("timepickerdisabled", "true");
        endpicker.setAttribute("timepickerdisabled", "true");

        tzStart.setAttribute("disabled", "true");
        tzEnd.setAttribute("disabled", "true");
        tzStart.removeAttribute("class");
        tzEnd.removeAttribute("class");
    } else {
        startpicker.removeAttribute("timepickerdisabled");
        endpicker.removeAttribute("timepickerdisabled");

        tzStart.removeAttribute("disabled");
        tzEnd.removeAttribute("disabled");
        tzStart.setAttribute("class", "text-link");
        tzEnd.setAttribute("class", "text-link");
    }
}

function changeAllDay() {
    var allDayElement = document.getElementById("all-day");
    var allDay = (allDayElement.getAttribute("checked") == "true");

    gStartDate = gStartDate.clone();
    gEndDate = gEndDate.clone();

    gStartDate.isDate = allDay;
    gEndDate.isDate = allDay;

    propagateDateTime();

    // After propagating the modified times we enforce some constraints
    // on the zoom-factor. in case this events is now said to be all-day,
    // we automatically enforce a 25% zoom-factor and disable the control.
    var zoom = document.getElementById("zoom-menulist");
    var zoomOut = document.getElementById("zoom-out-button");
    var zoomIn = document.getElementById("zoom-in-button");

    if (allDay) {
        zoom.value = "400";
        zoom.setAttribute("disabled", "true");
        zoomOut.setAttribute("disabled", "true");
        zoomIn.setAttribute("disabled", "true");
        setZoomFactor(zoom.value);
        setForce24Hours(true);
    } else {
        zoom.removeAttribute("disabled");
        zoomOut.removeAttribute("disabled");
        zoomIn.removeAttribute("disabled");
    }
}

function onResize() {
    // Don't do anything if we haven't been initialized.
    if (!gStartDate || !gEndDate) {
        return;
    }

    var grid = document.getElementById("freebusy-grid");
    var gridScrollbar = document.getElementById("horizontal-scrollbar");
    grid.fitDummyRows();
    var ratio = grid.boxObject.width / grid.documentSize;
    var maxpos = gridScrollbar.getAttribute("maxpos");
    var inc = maxpos * ratio / (1 - ratio);
    gridScrollbar.setAttribute("pageincrement", inc);

    var attendees = document.getElementById("attendees-list");
    var attendeesScrollbar = document.getElementById("vertical-scrollbar");
    var box = document.getElementById("vertical-scrollbar-box");
    attendees.fitDummyRows();
    var ratio = attendees.boxObject.height / attendees.documentSize;
    if (ratio < 1) {
        box.removeAttribute("collapsed");
        var maxpos = attendeesScrollbar.getAttribute("maxpos");
        var inc = maxpos * ratio / (1 - ratio);
        attendeesScrollbar.setAttribute("pageincrement", inc);
    } else {
        box.setAttribute("collapsed", "true");
    }
}

function onChangeCalendar(calendar) {
    var args = window.arguments[0];
    var organizer = args.organizer;

    // set 'mIsReadOnly' if the calendar is read-only
    if (calendar && calendar.readOnly) {
        gIsReadOnly = true;
    }

    // assume we're the organizer [in case that the calendar
    // does not support the concept of identities].
    gIsInvitation = false;
    if (calInstanceOf(args.item.calendar, Components.interfaces.calISchedulingSupport)) {
        gIsInvitation = args.item.calendar.isInvitation(args.item);
    }

    if (gIsReadOnly || gIsInvitation) {
        document.getElementById("next-slot")
            .setAttribute('disabled', 'true');
        document.getElementById("previous-slot")
            .setAttribute('disabled', 'true');
    }

    var freebusy = document.getElementById("freebusy-grid");
    freebusy.onChangeCalendar(calendar);
}

function updateButtons() {
    var previousButton = document.getElementById("previous-slot");
    if (gUndoStack.length > 0) {
        previousButton.removeAttribute('disabled');
    } else {
        previousButton.setAttribute('disabled', 'true');
    }
}

function onNextSlot() {
    // Store the current setting in the undo-stack.
    var currentSlot = {};
    currentSlot.startTime = gStartDate;
    currentSlot.endTime = gEndDate;
    gUndoStack.push(currentSlot);

    // Ask the grid for the next possible timeslot.
    var grid = document.getElementById("freebusy-grid");
    var startRangePicker = document.getElementById("range-starttime");
    var endRangePicker = document.getElementById("range-endtime");
    grid.setRange(startRangePicker.value, endRangePicker.value);

    var duration = gEndDate.subtractDate(gStartDate);
    var start = grid.nextSlot();
    var end = start.clone();
    end.addDuration(duration);
    if (start.isDate) {
        end.day++;
    }
    gStartDate = start.clone();
    gEndDate = end.clone();
    var endDate = gEndDate.clone();

    // Check if an all-day event has been passed in (to adapt endDate).
    if (gStartDate.isDate) {
        gEndDate.day--;
    }
    gStartDate.makeImmutable();
    gEndDate.makeImmutable();
    endDate.makeImmutable();

    propagateDateTime();

    // Scroll the grid/timebar such that the current time is visible
    scrollToCurrentTime();

    updateButtons();
}

function onPreviousSlot() {
    var previousSlot = gUndoStack.pop();
    if (!previousSlot) {
        return;
    }

    // In case the new starttime happens to be scheduled
    // on a different day, we also need to update the
    // complete freebusy informations and appropriate
    // underlying arrays holding the information.
    var refresh = previousSlot.startTime.day != gStartDate.day;

    gStartDate = previousSlot.startTime.clone();
    gEndDate = previousSlot.endTime.clone();
    var endDate = gEndDate.clone();

    propagateDateTime();

    // scroll the grid/timebar such that the current time is visible
    scrollToCurrentTime();

    updateButtons();

    if (refresh) {
        var grid = document.getElementById("freebusy-grid");
        grid.forceRefresh();
    }
}

function onMinus() {
    var timebar = document.getElementById("timebar");
    var ratio = timebar.scroll;
    ratio -= timebar.step;
    if (ratio <= 0.0) {
        ratio = 0.0;
    }
    var scrollbar = document.getElementById("horizontal-scrollbar");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute("curpos", ratio * maxpos);
}

function onPlus() {
    var timebar = document.getElementById("timebar");
    var ratio = timebar.scroll;
    ratio += timebar.step;
    if (ratio >= 1.0) {
        ratio = 1.0;
    }
    var scrollbar = document.getElementById("horizontal-scrollbar");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute("curpos", ratio * maxpos);
}

function scrollToCurrentTime() {
    var timebar = document.getElementById("timebar");
    var ratio = (gStartDate.hour - gStartHour) * timebar.step;
    if (ratio <= 0.0) {
        ratio = 0.0;
    }
    if (ratio >= 1.0) {
        ratio = 1.0;
    }
    var scrollbar = document.getElementById("horizontal-scrollbar");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute("curpos", ratio * maxpos);
}


function setZoomFactor(aValue) {
    if (gZoomFactor == aValue) {
        return aValue;
    }

    gZoomFactor = aValue;
    var timebar = document.getElementById("timebar");
    timebar.zoomFactor = gZoomFactor;
    var selectionbar = document.getElementById("selection-bar");
    selectionbar.zoomFactor = gZoomFactor;
    var grid = document.getElementById("freebusy-grid");
    grid.zoomFactor = gZoomFactor;

    // Calling onResize() will update the scrollbars and everything else
    // that needs to adopt the previously made changes. We need to call
    // this after the changes have actually been made...
    onResize();

    var scrollbar = document.getElementById("horizontal-scrollbar");
    if (scrollbar.hasAttribute("maxpos")) {
        var curpos = scrollbar.getAttribute("curpos");
        var maxpos = scrollbar.getAttribute("maxpos");
        var ratio = curpos / maxpos;
        timebar.scroll = ratio;
        grid.scroll = ratio;
        selectionbar.ratio = ratio;
    }

    return aValue;
}

function setForce24Hours(aValue) {
    if (gForce24Hours == aValue) {
      return aValue;
    }

    gForce24Hours = aValue;
    initTimeRange();
    var timebar = document.getElementById("timebar");
    timebar.force24Hours = gForce24Hours;
    var selectionbar = document.getElementById("selection-bar");
    selectionbar.force24Hours = gForce24Hours;
    var grid = document.getElementById("freebusy-grid");
    grid.force24Hours = gForce24Hours;

    // Calling onResize() will update the scrollbars and everything else
    // that needs to adopt the previously made changes. We need to call
    // this after the changes have actually been made...
    onResize();

    var scrollbar = document.getElementById("horizontal-scrollbar");
    if (!scrollbar.hasAttribute("maxpos")) {
        return aValue;
    }
    var curpos = scrollbar.getAttribute("curpos");
    var maxpos = scrollbar.getAttribute("maxpos");
    var ratio = curpos / maxpos;
    timebar.scroll = ratio;
    grid.scroll = ratio;
    selectionbar.ratio = ratio;

    return aValue;
}

function initTimeRange() {
    if (gForce24Hours) {
        gStartHour = 0;
        gEndHour = 24;
    } else {
        gStartHour = getPrefSafe("calendar.view.daystarthour", 8);
        gEndHour = getPrefSafe("calendar.view.dayendhour", 19);
    }

    var prefixes = [ "start", "end" ];
    for each (var prefix in prefixes) {
        var rangePicker = document.getElementById("range-" + prefix + "time");
        var rangeTime = new Date();
        rangePicker.disabled = gForce24Hours;
        if (prefix == "start") {
            rangeTime.setHours(gStartHour);
        }
        else {
            rangeTime.setHours(gEndHour);
        }
        rangeTime.setMinutes(0);
        rangeTime.setSeconds(0);
        rangePicker.update(rangeTime);
    }
}

function onModify(event) {
    onResize();
    document.getElementById(
        "freebusy-grid")
            .onModify(event);
}

function onRowChange(event) {
    var scrollbar = document.getElementById("vertical-scrollbar");
    var attendees = document.getElementById("attendees-list");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute(
        "curpos",
        event.details / attendees.mMaxAttendees * maxpos);
}

function onMouseScroll(event) {
    // ignore mouse scrolling for now...
    event.stopPropagation();
}

function onAttrModified(event) {
    if (event.attrName == "width") {
        var selectionbar = document.getElementById("selection-bar");
        selectionbar.setWidth(selectionbar.boxObject.width);
        return;
    }

    // Synchronize grid and attendee list
    var target = event.originalTarget;
    if (target.hasAttribute("anonid") &&
        target.getAttribute("anonid") == "input" &&
        event.attrName == "focused") {
        var attendees = document.getElementById("attendees-list");
        if (event.newValue == "true") {
            var grid = document.getElementById("freebusy-grid");
            if (grid.firstVisibleRow != attendees.firstVisibleRow) {
                grid.firstVisibleRow = attendees.firstVisibleRow;
            }
        } else {
            if (!target.lastListCheckedValue
                || target.lastListCheckedValue != target.value) {
                attendees.resolvePotentialList(target);
                target.lastListCheckedValue = target.value;
            }
        }
    }

    if (event.originalTarget.localName == "scrollbar") {
        var scrollbar = event.originalTarget;
        if (scrollbar.hasAttribute("maxpos")) {
            if (scrollbar.getAttribute("id") == "vertical-scrollbar") {
                var attendees = document.getElementById("attendees-list");
                var grid = document.getElementById("freebusy-grid");
                if (event.attrName == "curpos") {
                    var maxpos = scrollbar.getAttribute("maxpos");
                    attendees.ratio = event.newValue / maxpos;
                }
                grid.firstVisibleRow = attendees.firstVisibleRow;
            } else if (scrollbar.getAttribute("id") == "horizontal-scrollbar") {
                if (event.attrName == "curpos") {
                    var maxpos = scrollbar.getAttribute("maxpos");
                    var ratio = event.newValue/maxpos;
                    var timebar = document.getElementById("timebar");
                    var grid = document.getElementById("freebusy-grid");
                    var selectionbar = document.getElementById("selection-bar");
                    timebar.scroll = ratio;
                    grid.scroll = ratio;
                    selectionbar.ratio = ratio;
                }
            }
        }
    }
}

function onTimebar(event) {
    document.getElementById(
        "selection-bar")
            .init(event.details, event.height);
}

function onTimeRange(value) {
    var rangeTime = document.getElementById("range-time");
    if (value == "range") {
        rangeTime.removeAttribute("collapsed");
    }
    else {
        rangeTime.setAttribute("collapsed", "true");
    }
}

function onTimeChange(event) {
    var start = event.startDate.getInTimezone(gStartTimezone);
    var end = event.endDate.getInTimezone(gEndTimezone);

    loadDateTime(start, end);

    // fill the controls
    updateDateTime();

    // tell the timebar about the new start/enddate
    var timebar = document.getElementById("timebar");
    timebar.startDate = gStartDate;
    timebar.endDate = gEndDate;
    timebar.refresh();

    // tell the freebusy grid about the new start/enddate
    var grid = document.getElementById("freebusy-grid");

    var refresh = (grid.startDate == null) ||
                  (grid.startDate.compare(gStartDate) != 0) ||
                  (grid.endDate == null) ||
                  (grid.endDate.compare(gEndDate) != 0);
    grid.startDate = gStartDate;
    grid.endDate = gEndDate;
    if (refresh) {
        grid.forceRefresh();
    }
}

/* freeBusyRequestListener:
   A dumb listener that associates cache entries, client requests and freebusy
   requests for further handling by freeBusyRowController. */
function freeBusyRequestListener(aFBRowController, aStart, aEnd,
                                 aFetchStart, aFetchEnd,
                                 aCacheEntry) {
    this.mController = aFBRowController;
    this.mStart = aStart;
    this.mEnd = aEnd;
    this.mFetchStart = aFetchStart;
    this.mFetchEnd = aFetchEnd;
    this.mCacheEntry = aCacheEntry;
}

freeBusyRequestListener.prototype = {
    mController: null,

    mStart: null,
    mEnd: null,

    onResult: function fBRL_onResult(aRequest, aEntries) {
        this.mController.onResult(aRequest, aEntries,
                                  this.mStart, this.mEnd,
                                  this.mFetchStart, this.mFetchEnd,
                                  this.mCacheEntry);
    }
};

/* freeBusyCacheEntry:
   A "smart" cache entry object that provides date and content management
   methods. */
function freeBusyCacheEntry(calId) {
    this.mCalId = calId;
}

freeBusyCacheEntry.prototype = {
    mCalId: null,

    mStart: null,
    mEnd: null,
    mEntries: null,

    /* returns null if any of the dates are not covered by the cache */
    getEntries: function fCBE_getEntries(aStart, aEnd) {
        var entries = null;

        if (this.mStart && this.mEnd
            && aStart.compare(this.mStart) >= 0
            && aEnd.compare(this.mEnd) <= 0) {
            entries = [];

            for each (var entry in this.mEntries) {
                if (entry.interval
                    && entry.interval.start.compare(aEnd) <= 0
                    && entry.interval.end.compare(aStart) >= 0) {
                    entries.push(entry);
                }
            }
        }

        return entries;
    },

    /* returns an array of start/end ranges needed to complete the array of entries */
    getFetchDates: function fCBE_getEntries(aStart, aEnd) {
        var fetchDates;
        if (this.mStart && this.mEnd) {
            fetchDates = [];

            if (aStart.compare(this.mStart) < 0) {
                var extraDuration = Components.classes["@mozilla.org/calendar/duration;1"]
                                              .createInstance(Components.interfaces.calIDuration);
                extraDuration.days = -15;
                var start = aStart.clone();
                start.addDuration(extraDuration);
                var dates = { start: start, end: this.mStart };
                fetchDates.push(dates);
            }
            if (aEnd.compare(this.mEnd) > 0) {
                var extraDuration = Components.classes["@mozilla.org/calendar/duration;1"]
                                              .createInstance(Components.interfaces.calIDuration);
                extraDuration.days = 15;
                var end = aEnd.clone();
                end.addDuration(extraDuration);
                var dates = { start: this.mEnd, end: end };
                fetchDates.push(dates);
            }
        } else {
            fetchDates = [{ start: aStart, end: aEnd }];
        }

        return fetchDates;
    },

    /* append/prepend the additional entries */
    integrateEntries: function fCBE_integrateEntries(aEntries, aStart, aEnd) {
        if (!aEntries) {
            var this_ = this;
            var entry = {
                calId: null,
                interval: null,
                freeBusyType: Components.interfaces.calIFreeBusyInterval.UNKNOWN,
                QueryInterface: function cFBI_QueryInterface(aIID) {
                    return doQueryInterface(this,
                                            calFreeBusyInterval.prototype,
                                            aIID,
                                            [Components.interfaces.calIFreeBusyInterval]);
                }
            };
            entry.calId = this.mCalId;
            var interval = Components.classes["@mozilla.org/calendar/period;1"]
                .createInstance(Components.interfaces.calIPeriod);
            interval.start = aStart;
            interval.end = aEnd;
            entry.interval = interval;
            aEntries = [ entry ];
        }

        if (this.mStart) {
            if (aStart.compare(this.mStart) > 0) {
                for each (var entry in aEntries) {
                    if (entry.interval.start.compare(this.mEnd) >= 0) {
                        this.mEntries.push(entry);
                    }
                }
                this.mEnd = aEnd;
            } else {
                for each (var entry in aEntries) {
                    if (entry.interval.end.compare(this.mStart) <= 0) {
                        this.mEntries.push(entry);
                    }
                }
                this.mStart = aStart;
            }
        } else {
            this.mEntries = aEntries;
            this.mStart = aStart;
            this.mEnd = aEnd;
        }
    }
};

/* freeBusyRowController:
   Attempt cache requests. If those fail, request the freebusy from the
   calendars in order to populate the cache and then restart the cache
   requests. */
var freeBusyCache = {};

function freeBusyRowController(aFreeBusyRow) {
    this.mFreeBusyRow = aFreeBusyRow;
    this.mPendingRequests = [];
}

freeBusyRowController.prototype = {
    mFreeBusyRow: null,

    mPendingRequests: null,

    fetchFreeBusy: function fBRC_fetchFreeBusy(aStart, aEnd) {
        var calId = this.mFreeBusyRow.getAttribute("calid").toLowerCase();
        var cacheEntry = freeBusyCache[calId];
        if (!cacheEntry) {
            cacheEntry = new freeBusyCacheEntry(calId);
            freeBusyCache[calId] = cacheEntry;
        }

        var entries = cacheEntry.getEntries(aStart, aEnd);
        if (entries) {
            this.mFreeBusyRow.onFreeBusy(entries);
        }
        else {
            var fbService = getFreeBusyService();
            var fetchDates = cacheEntry.getFetchDates(aStart, aEnd);
            for each (var fetchDate in fetchDates) {
                var listener = new freeBusyRequestListener(this,
                                                           aStart, aEnd,
                                                           fetchDate.start,
                                                           fetchDate.end,
                                                           cacheEntry);
                var request = fbService.getFreeBusyIntervals(calId,
                                                             fetchDate.start,
                                                             fetchDate.end,
                                                             Components.interfaces.calIFreeBusyInterval.BUSY_ALL,
                                                             listener);
                if (request && request.isPending) {
                    this.mPendingRequests.push(request);
                }
            }
        }
        // }
        // catch (ex) {
        //     Components.utils.reportError(ex);
        // }
    },

    onResult: function fBRC_onResult(aRequest, aEntries, aStart, aEnd,
                                     aFetchStart, aFetchEnd, aCacheEntry) {
        if (aRequest && !aRequest.isPending) {
            // Find request in list of pending requests and remove from queue:
            function neq(aOp) {
                return (aRequest.id != aOp.id);
            }
            this.mPendingRequests = this.mPendingRequests.filter(neq);

            aCacheEntry.integrateEntries(aEntries, aFetchStart, aFetchEnd);
            var entries = aCacheEntry.getEntries(aStart, aEnd);
            if (entries) {
                /* the fact that entries are returned for the given timerange
                   is a sign that we reached the last response to our
                   request. */
                this.mFreeBusyRow.onFreeBusy(entries);
            }
        }
    },

    onUnload: function fBRC_onUnload() {
        // Cancel pending free/busy requests
        for each (var request in this.mPendingRequests) {
            request.cancel(null);
        }

        this.mPendingRequests = [];
    }
};


/* conflict handler:
   Wander through the list of attendees and "returns" false when at least one
   of those have a freebusy entry matching the current event. */
function conflictHandler(attendees, startDate, endDate, listener) {
    this.mAttendees = attendees;

    this.mStartDate = jsDateToDateTime(startDate);
    this.mEndDate = jsDateToDateTime(endDate);

    this.mListener = listener;
}

conflictHandler.prototype = {
  mAttendees: null,
  mCurrentCalId: 0,

  mStartDate: null,
  mEndDate: null,

  mListener: null,

  start: function cH_start() {
      this.mCurrentCalId = 0;
      this._step();
  },

  _step: function cH__step() {
      if (this.mCurrentCalId < this.mAttendees.length) {
          this._readFreeBusy(this.mAttendees[this.mCurrentCalId]);
      }
      else {
          this.mListener.onRequestComplete(true);
      }
  },

  _readFreeBusy: function cH__readFreeBusy(attendee) {
      var calId = attendee.id.toLowerCase();
      var cacheEntry = freeBusyCache[calId];
      if (!cacheEntry) {
          cacheEntry = new freeBusyCacheEntry(calId);
          freeBusyCache[calId] = cacheEntry;
      }

      var entries = cacheEntry.getEntries(this.mStartDate, this.mEndDate);
      if (entries) {
          this.onResult(null, entries);
      }
      else {
          var fbService = getFreeBusyService();
          fbService.getFreeBusyIntervals(calId,
                                         this.mStartDate, this.mEndDate,
                                         Components.interfaces.calIFreeBusyInterval.BUSY_ALL,
                                         this);
      }
  },

  onResult: function cH_onResult(aRequest, aEntries) {
      if (aEntries.length > 0) {
          var canClose = true;
          for (var i = 0; canClose && i < aEntries.length; i++) {
              if (aEntries[i].freeBusyType
                  == Components.interfaces.calIFreeBusyInterval.BUSY) {
                  canClose = false;
              }
          }
          this.mListener.onRequestComplete(canClose);
      }
      else {
          this.mCurrentCalId++;
          this._step();
      }
  }
};
