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
const fsPromise = require( 'fs' ).promises ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'win32-platform' ) ;




exports.typePerExtension = {
	exe: 'native'
} ;



exports.getAppDataDir = appName => path.join( os.homedir() , 'AppData' , 'Local' , appName ) ;



exports.extractIconFromExe = async ( exePath , iconPath ) => {
	try {
		var exeIconExtractor = require( 'exe-icon-extractor' ) ;
	}
	catch ( error ) {
		log.error( "Requiring the 'exe-icon-extractor' package failed: %E" , error ) ;
		return false ;
	}

	try {
		let buffer = exeIconExtractor.extractIcon( exePath , 'large' ) ;
		await fsPromise.writeFile( iconPath , buffer ) ;
		log.verbose( "Wrote extracted icon to: %s" , iconPath ) ;
	}
	catch ( error ) {
		log.error( "Extract icon error: %E" , error ) ;
		return false ;
	}

	return true ;
} ;

