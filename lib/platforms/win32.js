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
const ms = require( '@cronvel/ms-kit' ) ;

const string = require( 'string-kit' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;




exports.typePerExtension = {
	exe: 'native' ,
	bat: 'shell' ,
	lnk: 'lnk'
} ;



exports.getAppDataDir = appName => path.join( os.homedir() , 'AppData' , 'Local' , appName + '.data' ) ;



// Using @cronvel/ms-kit
exports.extractIcon = async ( exePath , iconPath , index = 0 , size = 256 ) => {
	try {
		var result = await ms.powershell.extractIcon( {
			source: exePath , destination: iconPath , index , size
		} ) ;
		log.verbose( "Wrote extracted icon to: %s" , result.destination ) ;
	}
	catch ( error ) {
		log.error( "ms.powershell.extractIcon() error: %E" , error ) ;
		return false ;
	}

	return true ;
} ;



exports.isLink = async ( linkPath ) => path.extname( linkPath ).toLowerCase() === '.lnk' ;

// Using @cronvel/ms-kit
exports.extractLink = async ( linkPath ) => {
	try {
		var linkData = await ms.powershell.readShortcutLink( linkPath ) ;
	}
	catch ( error ) {
		log.error( "ms.powershell.readShortcutLink() error: %E" , error ) ;
		return null ;
	}

	if ( path.extname( linkData.targetPath ).toLowerCase() !== '.exe' ) {
		log.error( ".extractLink(): the targetPath '%s' is not an exe" , linkData.targetPath ) ;
		return null ;
	}

	return powershellLinkToConfig( linkData ) ;
} ;



const NON_APP_REGEXP = /(?:^|[^A-Za-z0-9])(?:(?:un)?install(?:er)?|plugin)(?:[^A-Za-z0-9]|$)/i ;

exports.getInstalledAppList = async ( tmpIconDir = null ) => {
	var appxPackageList , startMenuLinkList ;

	try {
		appxPackageList = await ms.powershell.getAppxPackageList() ; // ( { iconPath: true } ) ;
	}
	catch ( error ) {
		log.error( "ms.powershell.getAppxPackageList() error: %E" , error ) ;
		return null ;
	}

	try {
		startMenuLinkList = await ms.powershell.getStartMenuShortcutLinkList( { extractIconDir: tmpIconDir } ) ;
	}
	catch ( error ) {
		log.error( "ms.powershell.getStartMenuShortcutLinkList() error: %E" , error ) ;
		return null ;
	}


	var list = [] ;

	for ( let configSource of appxPackageList ) {
		let name ;

		if ( configSource.displayName && ! configSource.displayName.startsWith( 'ms-resource:' ) ) {
			name = configSource.displayName ;
		}
		else {
			name = configSource.appName ;
			let match = configSource.appName.match( /[^.]+$/ ) ;
			if ( match ) { name = match[ 0 ] ; }
			name = string.toTitleCase( string.camelCaseToSeparated( name ) ) ;
		}

		if (
			name.match( NON_APP_REGEXP )
			|| configSource.appName.match( /^microsoft\..+extension.*/i )
			|| ! configSource.iconPath
		) {
			// Try removing installer/uninstaller, using a RegExp
			// Also remove app without icon, it's probably not an user app
			continue ;
		}

		configSource.sourceType = 'appx' ;

		let appConfig = {
			id: configSource.packageFamilyName ,	// It can be used a unique ID
			name ,
			type: 'appx' ,
			appId: configSource.packageFamilyName + "!App" ,

			icon: configSource.iconPath ,

			configSource
		} ;

		list.push( appConfig ) ;
	}

	for ( let configSource of startMenuLinkList ) {
		if (
			! configSource.targetPath.endsWith( '.exe' )
			|| configSource.targetPath.match( /[a-z]:\\windows\\/i )
			//|| configSource.targetPath.endsWith( '\\msiexec.exe' )
			|| configSource.appName.match( NON_APP_REGEXP )
			|| ! configSource.extractedIconPath
		) {
			// Try removing installer/uninstaller, using a RegExp
			// Also remove app without icon, it's probably not an user app
			continue ;
		}

		configSource.sourceType = 'startMenuLink' ;

		list.push( powershellLinkToConfig( configSource ) ) ;
	}

	list.sort( ( a , b ) => string.naturalSort( a.name , b.name ) ) ;

	return list ;
} ;




function powershellLinkToConfig( configSource ) {
	return {
		name: configSource.appName ,
		type: 'native' ,
		exe: ms.resolvePath( configSource.targetPath ) ,
		args: configSource.arguments ,
		directory: ms.resolvePath( configSource.workingDirectory ) ,

		icon: ms.resolvePath( configSource.iconPath ) ,
		iconIndex: configSource.iconIndex || undefined ,
		//autoUpdateIconPath: ms.resolvePath( configSource.iconPath ) ,
		//autoUpdateIconIndex: configSource.iconIndex || undefined ,

		description: configSource.description || undefined ,

		configSource
	} ;
}

