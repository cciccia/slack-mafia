import * as Enum from './constants';

const kebab = require('kebab-case');
const edn = require('jsedn');

function initCap(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function keywordToEnum(keyword: String): number {
    const kwVal = keyword.toString();
    if (kwVal[0] !== ':') {
        throw 'Not a valid keyword';
    }

    const [name, value] = kwVal.slice(1).split('/').map(item => initCap(kebab.reverse(item)));
    return Enum[name][value];
}

export function getEdn() {
    edn.setTagAction(new edn.Tag('sm', 'enum'), obj => keywordToEnum(obj));
    return edn;
}