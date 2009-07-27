#!/bin/bash -e

# Variables
BASE="`pwd`"
DATE="`date +%Y%m%d%H`"
VERSION=0.9.6-pre2

# Cleanin up the leftovers
alias cp=cp
rm -rf ./tmp/*
rm -rf ./output/*

#
# Lightning 0.9 / Apple Mac OS X
#
function build_osx {
    rm -rf $BASE/tmp
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9.mac.xpi -d tmp
    
    # We uncompress our archives
    cd $BASE/tmp/chrome/
    unzip -x calendar.jar
    unzip -x lightning.jar

    # We update chrome-related files
    cp -fr ../../src/calendar/base/themes/pinstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/

    cp -fr ../../src/calendar/lightning/content/imip-bar* content/lightning/

    # We first patch what we have to re-apply each time
    cd $BASE/tmp/chrome/content/calendar/
    # patch -p5 < $BASE/src/patches/inv-invitations-view-2.diff
    patch -p5 < $BASE/src/patches/462109.diff

    cd $BASE/tmp/js
    patch -p4 < $BASE/src/patches/468846.diff

    cd $BASE/tmp/chrome/
    rm -f calendar.jar; zip -9r calendar.jar content/calendar skin/classic/calendar
    rm -f lightning.jar; zip -9r lightning.jar content/lightning skin/classic/lightning
    rm -rf content skin

    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js

    # We update the JavaScript core files
    cp -f src/calendar/base/src/*.js tmp/js/
    cp -f src/calendar/providers/composite/*.js tmp/components/
    cp -f src/calendar/providers/storage/*.js tmp/js/

    # We update the french locale
    cd $BASE/src/calendar
    rm -f calendar-fr.jar
    zip -9r calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/

    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/$VERSION/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf

    # We regenerate the xpi
    cd $BASE/tmp
    rm -f ../output/lightning-$VERSION-inverse.mac.xpi
    zip -9r ../output/lightning-$VERSION-inverse.mac.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite

    # We exit
    cd $BASE; rm -rf ./tmp
}

#
# Lightning 0.9 / Microsoft Windows (32-bit)
#
function build_win32 {
    rm -rf $BASE/tmp
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9.win32.xpi -d tmp

    # We uncompress our archives
    cd $BASE/tmp/chrome/
    unzip -x calendar.jar
    unzip -x lightning.jar

    # We update chrome-related files
    cp -fr ../../src/calendar/base/themes/winstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/
    
    cp -fr ../../src/calendar/lightning/content/imip-bar* content/lightning/

    # We first patch what we have to re-apply each time
    cd $BASE/tmp/chrome/content/calendar/
    # patch -p5 < $BASE/src/patches/inv-invitations-view-2.diff
    patch -p5 < $BASE/src/patches/462109.diff

    cd $BASE/tmp/js
    patch -p4 < $BASE/src/patches/468846.diff

    cd $BASE/tmp/chrome/
    rm -f calendar.jar; zip -9r calendar.jar content/calendar skin/classic/calendar
    rm -f lightning.jar; zip -9r lightning.jar content/lightning skin/classic/lightning
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js

    # We update the JavaScript core files
    cp -f src/calendar/base/src/*.js tmp/js/
    cp -f src/calendar/providers/composite/*.js tmp/components/
    cp -f src/calendar/providers/storage/*.js tmp/js/

    # We copy the missing XPT file
    cd $BASE
    cp ./binaries/lightning/saxparser.xpt ./tmp/components
    
    # We update the french locale
    cd $BASE/src/calendar
    rm -f calendar-fr.jar
    zip -9r calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/

    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/$VERSION/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
   
    # We copy the missing XPT file
    cd $BASE
    cp ./binaries/lightning/saxparser.xpt ./tmp/components

    # We regenerate the xpi
    cd $BASE/tmp
    rm -f ../output/lightning-$VERSION-inverse.win32.xpi
    zip -r ../output/lightning-$VERSION-inverse.win32.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite
    cd $BASE; rm -rf ./tmp/*

    # We exit
    cd $BASE; rm -rf ./tmp
}

#
# Lightning 0.9 / GNU/Linux x86
#
function build_linux {
    rm -rf $BASE/tmp
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9.linux-i686.xpi -d tmp

    # We uncompress our archives
    cd $BASE/tmp/chrome/
    unzip -x calendar.jar
    unzip -x lightning.jar

    # We update chrome-related files
    cp -fr ../../src/calendar/base/themes/winstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/
    
    cp -fr ../../src/calendar/lightning/content/imip-bar* content/lightning/

    # We first patch what we have to re-apply each time
    cd $BASE/tmp/chrome/content/calendar/
    # patch -p5 < $BASE/src/patches/inv-invitations-view-2.diff
    patch -p5 < $BASE/src/patches/462109.diff

    cd $BASE/tmp/js
    patch -p4 < $BASE/src/patches/468846.diff

    cd $BASE/tmp/chrome/
    rm -f calendar.jar; zip -9r calendar.jar content/calendar skin/classic/calendar
    rm -f lightning.jar; zip -9r lightning.jar content/lightning skin/classic/lightning
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js

    # We update the JavaScript core files
    cp -f src/calendar/base/src/*.js tmp/js/
    cp -f src/calendar/providers/composite/*.js tmp/components/
    cp -f src/calendar/providers/storage/*.js tmp/js/
    
    # We update the french locale
    cd $BASE/src/calendar
    rm -f calendar-fr.jar
    zip -9r calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/

    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/$VERSION/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
   
    # We copy the missing XPT file
    cd $BASE
    cp ./binaries/lightning/saxparser.xpt ./tmp/components

    # We regenerate the xpi
    cd $BASE/tmp
    rm -f ../output/lightning-$VERSION-inverse.linux-i686.xpi
    zip -r ../output/lightning-$VERSION-inverse.linux-i686.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite
    cd $BASE; rm -rf ./tmp/*

    # We exit
    cd $BASE; rm -rf ./tmp
}

#
# Lightning 0.9 / GNU/Linux x86 / 64-bit
#
function build_linux_x64 {
    rm -rf $BASE/tmp
    cd $BASE
    /usr/bin/unzip binaries/lightning/lightning-0.9-linux-x86_64.xpi -d tmp

    # We uncompress our archives
    cd $BASE/tmp/chrome/
    unzip -x calendar.jar
    unzip -x lightning.jar

    # We update chrome-related files
    cp -fr ../../src/calendar/base/themes/winstripe/* skin/classic/calendar/
    cp -fr ../../src/calendar/base/content/* content/calendar/
    cp -fr ../../src/calendar/base/content/widgets/* content/calendar/widgets/
    
    cp -fr ../../src/calendar/lightning/content/imip-bar* content/lightning/

    # We first patch what we have to re-apply each time
    cd $BASE/tmp/chrome/content/calendar/
    # patch -p5 < $BASE/src/patches/inv-invitations-view-2.diff
    patch -p5 < $BASE/src/patches/462109.diff

    cd $BASE/tmp/js
    patch -p4 < $BASE/src/patches/468846.diff

    cd $BASE/tmp/chrome/
    rm -f calendar.jar; zip -9r calendar.jar content/calendar skin/classic/calendar
    rm -f lightning.jar; zip -9r lightning.jar content/lightning skin/classic/lightning
    rm -rf content skin
    
    # We update the preference file
    cd $BASE
    cp -f src/calendar/lightning/content/lightning.js tmp/defaults/preferences/lightning.js

    # We update the JavaScript core files
    cp -f src/calendar/base/src/*.js tmp/js/
    cp -f src/calendar/providers/composite/*.js tmp/components/
    cp -f src/calendar/providers/storage/*.js tmp/js/
    
    # We update the french locale
    cd $BASE/src/calendar
    rm -f calendar-fr.jar
    zip -9r calendar-fr.jar locale
    mv -f calendar-fr.jar ../../tmp/chrome/

    # We update the RDF file
    cd $BASE/tmp
    sed s/2008091721/$DATE/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/0.9/$VERSION/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"name>Lightning<"/"name>Lightning (Inverse Edition)<"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
    sed s/"http\:\/\/www.mozilla.org\/projects\/calendar\/releases\/lightning0\.9\.html"/"http\:\/\/inverse.ca\/contributions\/lightning\.html"/ install.rdf > install.rdf.tmp; mv -f install.rdf.tmp install.rdf
   
    # We copy the missing XPT file
    cd $BASE
    cp ./binaries/lightning/saxparser.xpt ./tmp/components

    # We regenerate the xpi
    cd $BASE/tmp
    rm -f ../output/lightning-$VERSION-inverse-linux-x86_64.xpi
    zip -r ../output/lightning-$VERSION-inverse-linux-x86_64.xpi chrome chrome.manifest components defaults install.rdf js platform timezones.sqlite

    # We exit
    cd $BASE; rm -rf ./tmp
}

#
# Which target do we build ? 
#
build_win32
build_osx
build_linux
build_linux_x64
