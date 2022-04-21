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
const fsKit = require( 'fs-kit' ) ;



exports.typePerExtension = {
	pdf: 'pdf'
} ;



exports.findIconFromFilePath = async ( filePath ) => {
	var iconPath , files ,
		dirname = path.dirname( filePath ) ,
		extension = path.extname( filePath ) ,
		basename = path.basename( filePath , extension ) ;

	iconPath = await existsWithBasenameAndExtensions( dirname , basename , [ 'ico' , 'png' ] ) ;
	if ( iconPath ) { return iconPath ; }

	iconPath = await existsWithExtensions( dirname , basename , [ 'ico' , 'png' ] ) ;
	if ( iconPath ) { return iconPath ; }

	return null ;
} ;



async function existsWithBasenameAndExtensions( dirname , basename , extensions ) {
	for ( let extension of extensions ) {
		let searchPath = path.join( dirname , basename + '.' + extension ) ;
		if ( await fsKit.isFile( searchPath ) ) { return searchPath ; }
	}

	return null ;
}



async function existsWithExtensions( dirname , basename , extensions ) {
	for ( let extension of extensions ) {
		let searchPattern = path.join( dirname , '*.' + extension ) ;
		try {
			let result = await fsKit.glob( searchPattern ) ;
			if ( result && result[ 0 ] ) { return result[ 0 ] ; }
		}
		catch ( error ) {}
	}

	return null ;
}

