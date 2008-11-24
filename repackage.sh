#!/bin/sh

# Variables
BASE=`pwd`
DATE=`date +%Y%m%d%H`

# Cleanin up the leftovers
alias cp=cp
rm -rf ./tmp/*
rm -rf ./output/*

#
# Lightning 0.9 / Apple Mac OS X
#
function build_osx {
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9.mac.xpi -d tmp
    
    # We uncompress our archives
    cd $BASE/tmp/chrome/
    jar -xvf calendar.jar

    # We first patch what we have to re-apply each time
    cd $BASE
    cp -f ./tmp/chrome/content/calendar/calendar-month-view.xml ./src/calendar/base/content/calendar-month-view.xml
    patch -p0 < ./src/patches/inv-invitations-view-2.diff

    # We update chrome-related files
    cd $BASE/tmp/chrome/
    cp -fr ../../src/calendar/base/themes/pinstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/
    rm -f calendar.jar
    jar -cvf calendar.jar content skin
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js
    
    # We update the JavaScript core files
    cd $BASE
    cp -f src/calendar/base/src/*.js tmp/js

    # We update the french locale
    cd $BASE/src/calendar
    jar -cvf calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/
    
    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/0.9.1pre4/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    
    # We regenerate the xpi
    cd $BASE/tmp
    zip -r ../output/lightning-0.9-inverse.mac.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite
    cd $BASE; rm -rf ./tmp/*
    
    # We exit
    cd $BASE
}

#
# Lightning 0.9 / Microsoft Windows (32-bit)
#
function build_win32 {
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9.win32.xpi -d tmp

    # We uncompress our archives
    cd $BASE/tmp/chrome/
    jar -xvf calendar.jar

    # We first patch what we have to re-apply each time
    cd $BASE
    cp -f ./tmp/chrome/content/calendar/calendar-month-view.xml ./src/calendar/base/content/calendar-month-view.xml
    patch -p0 < ./src/patches/inv-invitations-view-2.diff

    # We update chrome-related files
    cd $BASE/tmp/chrome/
    cp -fr ../../src/calendar/base/themes/winstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/    
    rm -f calendar.jar
    jar -cvf calendar.jar content skin
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js
    
    # We update the JavaScript core files
    cd $BASE
    cp -f src/calendar/base/src/*.js tmp/js
    
    # We update the french locale
    cd $BASE/src/calendar
    jar -cvf calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/

    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/0.9.1pre4/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
   
    # We copy the missing XPT file
    cd $BASE
    cp ./binaries/lightning/saxparser.xpt ./tmp/components

    # We regenerate the xpi
    cd $BASE/tmp
    zip -r ../output/lightning-0.9-inverse.win32.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite
    cd $BASE; rm -rf ./tmp/*
    
    # We exit
    cd $BASE
}

#
# Lightning 0.9 / GNU/Linux x86
#
function build_linux {
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9.linux-i686.xpi -d tmp

    # We uncompress our archives
    cd $BASE/tmp/chrome/
    jar -xvf calendar.jar

    # We first patch what we have to re-apply each time
    cd $BASE
    cp -f ./tmp/chrome/content/calendar/calendar-month-view.xml ./src/calendar/base/content/calendar-month-view.xml
    patch -p0 < ./src/patches/inv-invitations-view-2.diff

    # We update chrome-related files
    cd $BASE/tmp/chrome/
    cp -fr ../../src/calendar/base/themes/pinstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/
    rm -f calendar.jar
    jar -cvf calendar.jar content skin
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js
    
    # We update the JavaScript core files
    cd $BASE
    cp -f src/calendar/base/src/*.js tmp/js

    # We update the french locale
    cd $BASE/src/calendar
    jar -cvf calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/    

    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/0.9.1pre4/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    
    # We regenerate the xpi
    cd $BASE/tmp
    zip -r ../output/lightning-0.9-inverse.linux-i686.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite
    cd $BASE; rm -rf ./tmp/*
    
    # We exit
    cd $BASE
}

#
# Lightning 0.9 / GNU/Linux x86 / 64-bit
#
function build_linux_x64 {
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9-linux-x86_64.xpi -d tmp

    # We uncompress our archives
    cd $BASE/tmp/chrome/
    jar -xvf calendar.jar

    # We first patch what we have to re-apply each time
    cd $BASE
    cp -f ./tmp/chrome/content/calendar/calendar-month-view.xml ./src/calendar/base/content/calendar-month-view.xml
    patch -p0 < ./src/patches/inv-invitations-view-2.diff

    # We update chrome-related files
    cd $BASE/tmp/chrome/
    cp -fr ../../src/calendar/base/themes/pinstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/
    rm -f calendar.jar
    jar -cvf calendar.jar content skin
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js
    
    # We update the JavaScript core files
    cd $BASE
    cp -f src/calendar/base/src/*.js tmp/js

    # We update the french locale
    cd $BASE/src/calendar
    jar -cvf calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/
    
    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/0.9.1pre4/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    
    # We regenerate the xpi
    cd $BASE/tmp
    zip -r ../output/lightning-0.9-linux-x86_64.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite
    cd $BASE; rm -rf ./tmp/*
    
    # We exit
    cd $BASE
}

#
# Which target do we build ? 
#
build_osx
build_win32
build_linux
build_linux_x64
