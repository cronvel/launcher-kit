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

const string = require( 'string-kit' ) ;



exports.typePerExtension = {
	'sh': 'shell'
} ;



exports.getAppDataDir = appName => path.join( os.homedir() , '.local' , 'share' , appName ) ;



exports.getInstalledAppList = async ( tmpIconDir = null ) => {
	var list = [] ;

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

			if ( ! configSource ) { continue ; }

			configSource.__baseDirectory = baseDirectory ;
			configSource.__menuFile = menuFile ;

			if ( configSource.Icon ) {
				if ( path.isAbsolute( configSource.Icon ) ) {
					icon = configSource.Icon ;
				}
				else {
					// Icons are in <baseDirectory>/icons/<hicolor|lowcolor|HighContrast|gnome|whatever>/<256x256|whatever size>/apps/
					let iconPattern = baseDirectory + '/icons/hicolor/*/apps/' + ( configSource.Icon || id ) + '.@(png|svg)' ;
					let iconRegExp = new RegExp( '^' + string.escape.regExp( baseDirectory ) + '/icons/hicolor/(?:([0-9]+)x([0-9]+)|(scalable))/apps/' + string.escape.regExp( configSource.Icon || id ) + '\\.(png|svg)$' ) ;
					let iconPaths = await fsKit.glob( iconPattern ) ;

					const idealSize = 200 ;
					const scalableScore = 0.5 ;	// Scalable have less priority than 256x256 and 128x128, but more than 512x512 or 64x64
					iconPaths.sort( ( a , b ) => {
						var match , aSize , bSize , aScore , bScore ;
						match = a.match( iconRegExp ) ;
						aSize = match[ 3 ] ? scalableScore :
							+ match?.[ 1 ] || 0 ;
						aScore = aSize < idealSize ? aSize / idealSize : idealSize / aSize ;
						match = b.match( iconRegExp ) ;
						bSize = match[ 3 ] ? scalableScore :
							+ match?.[ 1 ] || 0 ;
						bScore = bSize < idealSize ? bSize / idealSize : idealSize / bSize ;
						return bScore - aScore ;
					} ) ;

					icon = iconPaths[ 0 ] ;
				}
			}

			let appConfig = {
				id ,
				name: configSource.Name ,
				type: 'native' ,

				icon ,
				description: configSource.Comment ,

				isConfig: true ,
				configSource
			} ;

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

