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
const fsKit = require( 'fs-kit' ) ;
const utils = require( '../utils.js' ) ;



const typeExt = ( type , ... extensions ) => extensions.forEach( e => exports.typePerExtension[ type ] = e ) ;

exports.typePerExtension = {
	pdf: 'pdf'
} ;

typeExt( 'image' , 'jpg' , 'jpeg' , 'png' , 'gif' , 'webp' , 'bmp' , 'tif' , 'tiff' , 'av1' ) ;
typeExt( 'audio' , 'wav' , 'mp3' , 'ogg' , 'flac' , 'wma' , 'alac' , 'aac' , 'aiff' , 'cda' ) ;



exports.getAppDataDir = appName => path.join( os.homedir() , '.local' , 'share' , appName ) ;



// Should be platform-specific
exports.extractIcon = () => null ;
exports.extractIcon.unsupported = true ;

exports.getInstalledAppList = () => null ;
exports.getInstalledAppList.unsupported = true ;



exports.findIconFromFilePath = async ( filePath ) => {
	var iconPath , files ,
		dirname = path.dirname( filePath ) ,
		extension = path.extname( filePath ) ,
		basename = path.basename( filePath , extension ) ;

	iconPath = await utils.existsWithBasenameAndExtensions( dirname , basename , [ 'ico' , 'png' ] , true ) ;
	if ( iconPath ) { return iconPath ; }

	iconPath = await utils.existsWithExtensions( dirname , basename , [ 'ico' , 'png' ] ) ;
	if ( iconPath ) { return iconPath ; }

	return null ;
} ;

