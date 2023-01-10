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
const fsKit = require( 'fs-kit' ) ;
const parseIni = require( 'ini' ).parse ;
const shellQuote = require( 'shell-quote' ) ;

const string = require( 'string-kit' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



exports.typePerExtension = {
	'sh': 'shell'
} ;



exports.getAppDataDir = appName => path.join( os.homedir() , '.local' , 'share' , appName ) ;

// Unknown are set to 0
const PREFERED_ICON_THEMES = {
	"hicolor": 10 ,
	"gnome": 8 ,
	"HighContrast": -5 ,
	"locolor": -3
} ;

exports.getInstalledAppList = async ( tmpIconDir = null ) => {
	var list = [] ;

	// Support for freedesktop.org .desktop files.
	// See: https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html
	var baseDirectories = process.env.XDG_DATA_DIRS ;
	if ( ! baseDirectories ) { return list ; }
	baseDirectories = baseDirectories.split( ':' ) ;

	// Maybe add some default directories? E.g. ~/Desktop is not always in XDG_DATA_DIRS

	for ( let baseDirectory of baseDirectories ) {
		if ( baseDirectory[ baseDirectory.length - 1 ] === '/' ) { baseDirectory = baseDirectory.slice( 0 , -1 ) ; }
		let menuFileList = await fsKit.glob( baseDirectory + '/applications/*.desktop' ) ;
		//console.log( "Menu files for" , baseDirectory , menuFileList ) ;

		for ( let menuFile of menuFileList ) {
			let id = path.basename( menuFile , '.desktop' ) ;
			let content = await fs.promises.readFile( menuFile , 'utf8' ) ;
			let menuConfig = parseIni( content ) ;
			let configSource = menuConfig['Desktop Entry'] ;
			let icon = null ;

			if ( ! configSource
				// If set, this app should not be displayed:
				|| configSource.NoDisplay || configSource.Hidden
				// If set, this is usually an app tweaking the desktop environment
				|| configSource.OnlyShowIn || configSource.NotShowIn
				// No Exec? Skip!
				|| ! configSource.Exec
			) {
				continue ;
			}

			configSource.__baseDirectory = baseDirectory ;
			configSource.__menuFile = menuFile ;

			if ( configSource.Icon ) {
				// Icon management, see: https://specifications.freedesktop.org/icon-theme-spec/icon-theme-spec-latest.html
				// We don't support .xpm, because not all frontend support them (e.g. web-based frontend like Electronjs)

				let includedExtensions = path.extname( configSource.Icon ) ;
				if ( includedExtensions !== '.png' && includedExtensions !== '.svg' ) { includedExtensions = '' ; }

				if ( path.isAbsolute( configSource.Icon ) ) {
					icon = configSource.Icon ;
				}
				else {
					// Icons are in <baseDirectory>/icons/<hicolor|lowcolor|HighContrast|gnome|whatever>/<256x256|whatever size>/apps/
					let iconPattern = baseDirectory + '/icons/*/*/apps/' + configSource.Icon + ( includedExtensions ? '' : '.@(png|svg)' ) ;
					let iconRegExp = new RegExp( '^' + string.escape.regExp( baseDirectory ) + '/icons/([^/]+)/(?:([0-9]+)x([0-9]+)|(scalable))/apps/' + string.escape.regExp( configSource.Icon || id ) + '\\.(png|svg)$' ) ;
					let iconPaths = await fsKit.glob( iconPattern ) ;

					if ( iconPaths && iconPaths.length ) {
						if ( iconPaths.length === 1 ) {
							icon = iconPaths[ 0 ] ;
						}
						else {
							const idealSize = 200 ;
							const scalableScore = 0.5 ;	// Scalable have less priority than 256x256 and 128x128, but more than 512x512 or 64x64
							iconPaths.sort( ( a , b ) => {
								var aMatch , bMatch , aSize , bSize , aScore , bScore ;

								aMatch = a.match( iconRegExp ) ;
								bMatch = b.match( iconRegExp ) ;

								// First sort on theme

								aScore = PREFERED_ICON_THEMES[ aMatch[ 1 ] ] || 0 ;
								bScore = PREFERED_ICON_THEMES[ bMatch[ 1 ] ] || 0 ;

								if ( aScore !== bScore ) { return bScore - aScore ; }

								// If the themes have the same score, sort on the image size

								aSize = aMatch[ 4 ] ? scalableScore :
									+ aMatch?.[ 2 ] || 0 ;
								aScore = aSize < idealSize ? aSize / idealSize : idealSize / aSize ;
								bSize = bMatch[ 4 ] ? scalableScore :
									+ bMatch?.[ 2 ] || 0 ;
								bScore = bSize < idealSize ? bSize / idealSize : idealSize / bSize ;

								return bScore - aScore ;
							} ) ;

							icon = iconPaths[ 0 ] ;
						}
					}
					else {
						// Fallback to pixmaps
						iconPattern = '/usr/share/pixmaps/' + configSource.Icon + ( includedExtensions ? '' : '.@(png|svg)' ) ;
						iconPaths = await fsKit.glob( iconPattern ) ;
						icon = iconPaths?.[ 0 ] ?? null ;
					}
				}
			}

			if ( ! icon ) {
				// We can confidently exclude app without icon, it's probably a bunch of useless/deprecated app
				// that the end-user have no idea it even exists
				log.verbose( "Excluding app %s because no icon was found" , configSource.Name ) ;
				continue ;
			}

			let appConfig = {
				id ,
				name: configSource.Name ,
				directory: configSource.Path || undefined ,

				icon ,
				description: configSource.Comment ,

				isConfig: true ,
				configSource
			} ;

			if ( configSource['X-Flatpak'] ) {
				appConfig.type = 'flatpak' ;
				appConfig.appId = configSource['X-Flatpak'] ;
			}
			else {
				let args = shellQuote.parse( configSource.Exec ) ;
				let exe = args.shift() ;
				appConfig.type = 'native' ;
				appConfig.exe = exe ;
				//appConfig.args = args ;
			}

			list.push( appConfig ) ;
		}
	}

	// Deduplicate by name
	var nameList = new Set() ;
	list = list.filter( item => {
		if ( nameList.has( item.name ) ) { return false ; }
		nameList.add( item.name ) ;
		return true ;
	} ) ;

	list.sort( ( a , b ) => string.naturalSort( a.name , b.name ) ) ;

	return list ;
} ;

