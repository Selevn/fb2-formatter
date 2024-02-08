require('dotenv').config();
const { parseStringPromise } = require('xml2js');
const iconv = require('iconv-lite');
const fs = require('fs');
const process = require('node:process');
const path = require("path");
const dir = process.env.DIR
const firstBytes = 256;
async function extractTitle(book, encoding) {
    const utf8Data = iconv.decode(fs.readFileSync(book), encoding);
    try{
        const result = await parseStringPromise(utf8Data)
        const title = result.FictionBook.description[0]['title-info'][0]['book-title']
        const author = result.FictionBook.description[0]['title-info'][0]['author'][0]
        return {title, author}
    } catch (e) {
        console.log(e.message)
        return null;
    }
}
async function detectEncoding(book) {
    const bufs = [];
    for await (const data of fs.createReadStream(book, { start : 0, end: firstBytes })) {
        bufs.push(data);
    }
    const finalBuffer = Buffer.concat(bufs);
    const encodingRegex = /encoding="([^"]+)"/;
    const match = finalBuffer.toString().match(encodingRegex);

    if (match && match[1]) {
        return match[1]
    }
    return null
}

function generateName({author, title}) {
    const names = [author['first-name'], author['middle-name'], author['last-name']].filter(item => !!item).join(' ') || 'Неизвестный автор'
    return `${names} - ${title}`
}

async function improveBooks(dir) {
    process.chdir(dir)

    const _dir = fs.readdirSync('.');
    const books = _dir.filter(file => file.endsWith('.fb2'))
    const notBooks = _dir.filter(file => !file.endsWith('.fb2'))

    for (const book of books) {
        const encoding = await detectEncoding(book)
        if(encoding){
            const parsedBook = await extractTitle(book, encoding)
            fs.renameSync(book, generateName(parsedBook)+'.fb2')
        }
    }

    if(process.env.SUBFOLDERS === 'true'){
        const folders = notBooks.filter(file => fs.lstatSync(path.join(process.cwd(),file)).isDirectory())
        for (const folder of folders) {
            await improveBooks(path.join(dir, folder))
        }
    }
}

improveBooks(dir).then(()=>{
    console.log('DONE!')
})
