#!/usr/bin/env node



const path = require( 'path' ) ;
const os = require( 'os' ) ;
const fsPromise = require( 'fs' ).promises ;

const ref = require( 'ref-napi' ) ;
const ffi = require( 'ffi-napi' ) ;
const Struct = require( 'ref-struct-di' )( ref ) ;



const IntPtr = ref.refType( 'int32' ) ;

const SHGFI = {
	Icon: 0x000000100,
	DisplayName: 0x000000200,
	TypeName: 0x000000400,
	Attributes: 0x000000800,
	IconLocation: 0x000001000,
	ExeType: 0x000002000,
	SysIconIndex: 0x000004000,
	LinkOverlay: 0x000008000,
	Selected: 0x000010000,
	Attr_Specified: 0x000020000,
	LargeIcon: 0x000000000,
	SmallIcon: 0x000000001,
	OpenIcon: 0x000000002,
	ShellIconSize: 0x000000004,
	PIDL: 0x000000008,
	UseFileAttributes: 0x000000010,
	AddOverlays: 0x000000020,
	OverlayIndex: 0x000000040
} ;

console.log( "A" ) ;
const Unmanaged260 = {
	size: 260 ,
	indirection: 1 ,
	alignment: 1 ,
	get: ( buffer, offset ) => buffer[ offest ] ,
	set: ( buffer, offset, value ) => buffer[ offset ] = value
} ;

const Unmanaged80 = {
	size: 80 ,
	indirection: 1 ,
	alignment: 1 ,
	get: ( buffer, offset ) => buffer[ offest ] ,
	set: ( buffer, offset, value ) => buffer[ offset ] = value
} ;

console.log( "B" ) ;
const SHFILEINFO = Struct( {
	NAMESIZE: 'int32' , //public const int NAMESIZE = 80;
	hIcon: IntPtr , //public IntPtr hIcon;
	iIcon: 'int32' , //public int iIcon;
	dwAttributes: 'uint32' , //public uint dwAttributes;
	Unmanaged260 , //[MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
	szDisplayName: 'string' , //public string szDisplayName;
	Unmanaged80 , //[MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
	szTypeName: 'string' //public string szTypeName
} ) ;
//console.log( "SHFILEINFO:" , SHFILEINFO ) ;

const SHFILEINFOPtr = ref.refType( SHFILEINFO ) ;



console.log( "C" ) ;
const shell32API = {
	SHGetFileInfo: [ IntPtr , [
		"string" , // pszPath
		"uint32" , // dwFileAttributes
		//SHFILEINFO , // psfi (ref SHFILEINFO)
		SHFILEINFOPtr , // psfi (ref SHFILEINFO)
		"uint32" , // cbFileInfo
		"uint32" // uFlags
	] ]
} ;
console.log( "D" ) ;



async function extractIconFromExe( exePath , iconPath ) {
	console.log( "Trying to load dll..." ) ;
	//var shell32 = ffi.Library( "C:\\Windows\\System32\\shell32.dll" , shell32API ) ;
	var shell32 = ffi.Library( "shell32.dll" , shell32API ) ;
	console.log( "Done!" ) ;
	var fileInfo = new SHFILEINFO() ;
	fileInfo.NAMESIZE = 80 ;
	//console.log( "E" , fileInfo.ref() ) ;
	console.log( "E" , fileInfo.NAMESIZE) ;

	//var buffer = shell32.SHGetFileInfo( exePath , 0 , fileInfo.ref() , SHFILEINFO.size , SHGFI.SysIconIndex | SHGFI.LargeIcon | SHGFI.UseFileAttributes ) ;
	shell32.SHGetFileInfo( exePath , 0 , fileInfo.ref() , SHFILEINFO.size , SHGFI.SysIconIndex | SHGFI.LargeIcon | SHGFI.UseFileAttributes ) ;
	//shell32.SHGetFileInfo( exePath , 0 , fileInfo.ref() , SHFILEINFO.size , SHGFI.DisplayName | SHGFI.UseFileAttributes ) ;
	console.log( "F" ) ;

	//console.log( "\n\n\nbuffer:" , buffer ) ;
	//console.log( "\n\n\nbuffer.deref:" , buffer.deref() ) ;
	console.log( "\n\n\nfileInfo:" , fileInfo ) ;
	console.log( "\n\n\n" ) ;
	console.log( "fileInfo.iIcon:" , fileInfo.iIcon ) ;
	console.log( "fileInfo.szDisplayName:" , fileInfo.szDisplayName ) ;
	console.log( "fileInfo.szTypeName:" , fileInfo.szTypeName ) ;
}



async function extractIconFromExe_old( exePath , iconPath ) {
	try {
		var icon256 = require( '@cronvel/icon256' ) ;
	}
	catch ( error ) {
		console.error( "Requiring the '@cronvel/icon256' package failed:" , error ) ;
		return false ;
	}

	try {
		let buffer = await icon256( exePath ) ;
		await fsPromise.writeFile( iconPath , buffer ) ;
		console.log( "Wrote extracted icon to: " , iconPath ) ;
	}
	catch ( error ) {
		console.log( "Extract icon error:" , error ) ;
		return false ;
	}

	return true ;
}

extractIconFromExe( "C:\\Program Files\\Mozilla Firefox\\firefox.exe" , "Z:\\win-icon\\extracted.ico" ) ;



