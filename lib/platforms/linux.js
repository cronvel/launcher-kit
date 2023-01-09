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

	var directories = process.env.XDG_DATA_DIRS ;
	if ( ! directories ) { return list ; }
	directories = directories.split( ':' ) ;

	// Maybe add some default directories? E.g. ~/Desktop is not always in XDG_DATA_DIRS

	for ( let directory of directories ) {
		if ( directory[ directory.length - 1 ] === '/' ) { directory = directory.slice( 0 , -1 ) ; }
		let menuFileList = await fsKit.glob( directory + '/applications/*.desktop' ) ;
		//console.log( "Menu files for" , directory , menuFileList ) ;

		for ( let menuFile of menuFileList ) {
			let id = path.basename( menuFile , '.desktop' ) ;
			let content = await fs.promises.readFile( menuFile , 'utf8' ) ;
			let menuConfig = parseIni( content ) ;
			let configSource = menuConfig['Desktop Entry'] ;

			if ( ! configSource ) { continue ; }

			// Icons are in <directory>/icons/<hicolor|lowcolor|HighContrast|gnome|whatever>/<256x256|whatever size>/apps/
			let iconPattern = directory + '/icons/hicolor/*/apps/' + ( configSource.Icon || id ) + '.png' ;
			let iconRegExp = new RegExp( '^' + string.escape.regExp( directory ) + '/icons/hicolor/([0-9]+)x([0-9]+)/apps/' + string.escape.regExp( configSource.Icon || id ) + '\\.[a-zA-Z]+$' ) ;
			let iconPaths = await fsKit.glob( iconPattern ) ;


			const idealSize = 200 ;
			iconPaths.sort( ( a , b ) => {
				var match , aSize , bSize , aScore , bScore ;
				match = a.match( iconRegExp ) ;
				aSize = + match?.[ 1 ] || 0 ;
				aScore = aSize < idealSize ? aSize / idealSize : idealSize / aSize ;
				match = b.match( iconRegExp ) ;
				bSize = + match?.[ 1 ] || 0 ;
				bScore = bSize < idealSize ? bSize / idealSize : idealSize / bSize ;
				return bScore - aScore ;
			} ) ;

			/*
			if ( id.includes( 'Wesnoth' ) ) {
				console.log( "Icon pattern:" , iconPattern , "found paths:" , iconPaths ) ;
				iconPaths.sort( ( a , b ) => {
					var match , aSize , bSize , aScore , bScore ;
					match = a.match( iconRegExp ) ;
					console.log( "match" , a , "-->" , match , iconRegExp ) ;
					aSize = + match?.[ 1 ] || 0 ;
					aScore = aSize < idealSize ? aSize / idealSize : idealSize / aSize ;
					match = b.match( iconRegExp ) ;
					console.log( "match" , b , "-->" , match ) ;
					bSize = + match?.[ 1 ] || 0 ;
					bScore = bSize < idealSize ? bSize / idealSize : idealSize / bSize ;
					console.log( "Sort:" , aScore , bScore ) ;
					return bScore - aScore ;
				} ) ;
			}
			//*/

			let appConfig = {
				id ,
				name: configSource.Name ,
				type: 'native' ,

				icon: iconPaths[ 0 ] || null ,
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

