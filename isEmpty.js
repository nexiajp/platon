'use strict';

function isEmpty(obj) {
	if ( typeof obj === 'undefined' ) return true;
	if ( Array.isArray(obj) ) {
		if ( typeof obj[0] === 'undefined' ) return true;
	}

	if (obj == null) return true;

	if (obj.length && obj.length > 0) return false;
	if (obj.length === 0) return true;

	for (var key in obj) {
		if (hasOwnProperty.call(obj, key)) return false;
	}
	return true;
}

module.exports = isEmpty;
