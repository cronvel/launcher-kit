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



exports.getAppDataDir = ( appName , channel = null ) => {
	var fullName = channel && channel !== 'release' && channel !== 'stable' ? appName + '-' + channel : appName ;
	return path.join( os.homedir() , 'AppData' , 'Local' , fullName + '.data' ) ;
} ;



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



exports.isLink = linkPath => path.extname( linkPath ).toLowerCase() === '.lnk' ;

// Using @cronvel/ms-kit
exports.extractLink = async ( linkPath ) => {
	try {
		var linkData = await ms.powershell.readShortcutLink( linkPath , { resolvePath: true } ) ;
	}
	catch ( error ) {
		log.error( "ms.powershell.readShortcutLink() for '%s' error: %E" , linkPath , error ) ;
		return null ;
	}

	if ( ! linkData.targetPath ) {
		log.error( ".extractLink(): no targetPath for '%s'" , linkPath ) ;
		return linkData ;
	}

	if ( path.extname( linkData.targetPath ).toLowerCase() !== '.exe' ) {
		log.warning( ".extractLink(): the targetPath for '%s' is not an exe: '%s'" , linkPath , linkData.targetPath ) ;
		return linkData ;
	}

	return powershellAppLinkToConfig( linkData ) ;
} ;



/*
	Note: there are some uninstallers called unins000.exe
*/
const NAME_AND_TARGET_BLACKLIST_REGEXP = [
	/(?:^|[^A-Za-z0-9])(?:(?:un|d[eé]s)?install(?:er)?|uninst?0*|plugin)(?:[^A-Za-z0-9]|$)/i ,
	/\\python[0-9.]+\\pythonw?\.exe/i ,
	/[a-z]:\\windows\\/i
	// /\\msiexec.exe/i
] ;

const APPX_APPNAME_BLACKLIST = new Set( [
	'microsoft.windowscommunicationsapps' ,
	'Microsoft.549981C3F5F10' , // Cortana
	//'MicrosoftWindows.Client.CBS', 'MicrosoftWindows.Client.WebExperience' ,
	//'Microsoft.WindowsStore' , 'Microsoft.StorePurchaseApp' ,
	'Microsoft.SecHealthUI' ,
	'Microsoft.GetHelp' ,
	'Microsoft.Getstarted' ,
	'MicrosoftCorporationII.QuickAssist' ,
	'Microsoft.PowerAutomateDesktop' ,
	'Microsoft.WindowsFeedbackHub' ,
	'Microsoft.YourPhone' ,
	'Microsoft.WindowsTerminal'
] ) ;

const APPX_APPNAME_AND_SUBAPPID_BLACKLIST_REGEXP = [
	/^microsoft\..+extension.*/i ,
	/^microsoftwindows\.client\./i ,
	/^microsoft.*\..*store.*/i ,
	/^microsoft.*\..*xbox.*/i
] ;

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
		startMenuLinkList = await ms.powershell.getStartMenuShortcutLinkList( { extractIconDir: tmpIconDir , resolvePath: true } ) ;
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
			! configSource.iconPath
			|| NAME_AND_TARGET_BLACKLIST_REGEXP.some( re => name.match( re ) )
			|| APPX_APPNAME_BLACKLIST.has( configSource.appName )
			|| APPX_APPNAME_AND_SUBAPPID_BLACKLIST_REGEXP.some( re => configSource.appName.match( re ) || configSource.subAppId.match( re ) )
		) {
			// Try removing installer/uninstaller, using a RegExp
			// Also remove app without icon, it's probably not an user app
			continue ;
		}

		configSource.sourceType = 'appx' ;

		let appConfig = {
			id: configSource.appId.replace( /!/g , '.' ) ,	// It can be used a unique ID
			name ,
			type: 'appx' ,
			appId: configSource.appId ,

			icon: configSource.iconPath ,

			isConfig: true ,
			configSource
		} ;

		list.push( appConfig ) ;
	}

	for ( let configSource of startMenuLinkList ) {
		if (
			! configSource.extractedIconPath
			|| ! configSource.targetPath.toLowerCase().endsWith( '.exe' )
			|| NAME_AND_TARGET_BLACKLIST_REGEXP.some( re => configSource.appName.match( re ) || configSource.targetPath.match( re ) )
		) {
			// Try removing installer/uninstaller, using a RegExp
			// Also remove app without icon, it's probably not an user app
			continue ;
		}

		configSource.sourceType = 'startMenuLink' ;

		list.push( powershellAppLinkToConfig( configSource ) ) ;
	}

	return list ;
} ;



function powershellAppLinkToConfig( configSource ) {
	return {
		name: configSource.appName ,
		type: 'native' ,
		exe: configSource.targetPath || null ,
		args: configSource.arguments ,
		directory: configSource.workingDirectory || null ,

		extractedIcon: configSource.extractedIconPath || null ,
		icon: configSource.iconPath || null ,
		iconIndex: configSource.iconIndex || undefined ,
		//autoUpdateIconPath: configSource.iconPath || null ,
		//autoUpdateIconIndex: configSource.iconIndex || undefined ,

		description: configSource.description || undefined ,

		isConfig: true ,
		configSource
	} ;
}

