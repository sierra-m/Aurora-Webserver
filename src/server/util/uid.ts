/*
* The MIT License (MIT)
*
* Copyright (c) 2024 Sierra MacLeod
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
* OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
*/

export const validateUID = (uid: string) => {
    return uid.match(/[0-9a-f]{8}\-[0-9a-f]{4}\-4[0-9a-f]{3}\-[89ab][0-9a-f]{3}\-[0-9a-f]{12}/i);
}


export const standardizeUID = (uid: string) => {
    let standardUid;
    if (uid.length === 22) {
        const asHex = Buffer.from(uid, 'base64url').toString('hex');
        standardUid = `${asHex.slice(0,8)}-${asHex.slice(8,12)}-${asHex.slice(12,16)}-${asHex.slice(16,20)}-${asHex.slice(20)}`;
    } else {
        standardUid = uid;
    }
    if (typeof standardUid === 'string' && validateUID(standardUid)) {
        return standardUid;
    }
}


export const compressUID = (uid: string) => {
    return Buffer.from(uid.replaceAll('-', ''), 'hex').toString('base64url');
}
