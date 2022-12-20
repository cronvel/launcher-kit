/*
	Launcher Kit

	Copyright (c) 2022 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const path = require( 'path' ) ;
const os = require( 'os' ) ;
const fs = require( 'fs' ) ;
const msKit = require( '@cronvel/ms-kit' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;




exports.typePerExtension = {
	exe: 'native' ,
	bat: 'shell' ,
	lnk: 'powershell-start-process'
} ;



exports.getAppDataDir = appName => path.join( os.homedir() , 'AppData' , 'Local' , appName + '.data' ) ;



// Using @cronvel/ms-kit
exports.extractIcon = async ( exePath , iconPath , index = 0 , size = 256 ) => {
	try {
		var result = await msKit.powershell.extractIcon( {
			source: exePath , destination: iconPath , index , size
		} ) ;
		log.verbose( "Wrote extracted icon to: %s" , result.destination ) ;
	}
	catch ( error ) {
		log.error( "msKit.powershell.extractIcon() error: %E" , error ) ;
		return false ;
	}

	return true ;
} ;



exports.getInstalledAppList = async ( tmpIconDir = null ) => {
	var appxPackageList , startMenuLinkList ;

	try {
		appxPackageList = await msKit.powershell.getAppxPackageList( { iconPath: true } ) ;
	}
	catch ( error ) {
		log.error( "msKit.powershell.getAppxPackageList() error: %E" , error ) ;
		return null ;
	}

	try {
		startMenuLinkList = await msKit.powershell.getStartMenuShortcutLinkList( {
			extractIconDir: tmpIconDir ,
			appOnly: true
		} ) ;
	}
	catch ( error ) {
		log.error( "msKit.powershell.getStartMenuShortcutLinkList() error: %E" , error ) ;
		return null ;
	}


	var list = [] ;

	for ( let configSource of appxPackageList ) {
		configSource.sourceType = 'appx' ;

		let appConfig = {
			id: configSource.packageFamilyName ,	// It can be used a unique ID
			name: configSource.appName ,

			// It's tmp, it should be moved to the appropriate Launcher Kit's directory
			icon: configSource.iconPath ,

			// Use a dedicated Appx launcher?
			type: 'powershell-start-process' ,
			//exe: // To be defined

			configSource
		} ;

		list.push( appConfig ) ;
	}

	for ( let configSource of startMenuLinkList ) {
		configSource.sourceType = 'startMenuLink' ;

		let appConfig = {
			name: configSource.appName ,

			// It's tmp, it should be moved to the appropriate Launcher Kit's directory
			icon: configSource.extractedIconPath ,
			autoUpdateIconPath: configSource.iconPath ,
			autoUpdateIconIndex: configSource.iconIndex || undefined ,

			// TMP? Should depends on the link target?
			type: 'powershell-start-process' ,
			exe: configSource.linkPath ,

			directory: configSource.workingDirectory ,
			args: configSource.arguments ,
			description: configSource.description || undefined ,

			configSource
		} ;

		list.push( appConfig ) ;
	}

	return list ;
} ;

