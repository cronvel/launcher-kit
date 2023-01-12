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

const minimalParsers = require( '../../minimalParsers.js' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



const STEAM_PATH = path.join( os.homedir() , '.local/share/Steam' ) ;



module.exports = async ( tmpIconDir = null , list = [] , steamPath = STEAM_PATH ) => {
	var library , baseDirectories ,
		libraryFilePath = path.join( steamPath , 'steamapps/libraryfolders.vdf' ) ,
		iconDirectory = path.join( steamPath , 'appcache/librarycache' ) ;

	try {
		let content = await fs.promises.readFile( libraryFilePath , 'utf8' ) ;
		library = minimalParsers.parseVDF( content ) ;
		baseDirectories = library.libraryfolders.map( item => item.path ) ;
	}
	catch ( error ) {
		log.verbose( "No Steam lib detected" ) ;
		return list ;
	}

	for ( let baseDirectory of baseDirectories ) {
		let appManifestFileList = await fsKit.glob( baseDirectory + '/steamapps/appmanifest_*.acf' ) ;

		for ( let appManifestFile of appManifestFileList ) {
			let content = await fs.promises.readFile( appManifestFile , 'utf8' ) ;
			let appManifest = minimalParsers.parseVDF( content ) ;
			let configSource = appManifest.AppState ;
			let name = configSource.name ;
			let appId = configSource.appid ;
			let id = name + '_' + appId ;

			// They are only 32x32
			let icon = path.join( iconDirectory , appId + '_icon.jpg' ) ;
			// They are 460x215
			let cover = path.join( iconDirectory , appId + '_header.jpg' ) ;
			// They are 600x900
			//let icon = path.join( iconDirectory , appId + '_library_600x900.jpg' ) ;
			// They are 1920x620
			//let icon = path.join( iconDirectory , appId + '_library_hero.jpg' ) ;

			// Don't include games without icons or covers, there are most likely not apps
			if ( ! await fsKit.isFile( icon ) || ! await fsKit.isFile( cover ) ) { continue ; }

			let appConfig = {
				id ,
				name ,
				type: 'steam' ,
				appId ,
				icon ,
				cover ,

				isConfig: true ,
				configSource
			} ;

			list.push( appConfig ) ;
		}
	}

	return list ;
} ;

