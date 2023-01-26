console.log("scrapping liveuamap.com");

const puppeteer = require("puppeteer");
const moment = require("moment");

const fs = require("fs");

const axios = require("axios");


const isPaginated = process.argv[2] !== undefined ? process.argv[2] : false;

const BASEURL = "https://liveuamap.com";

const URLs = [
    BASEURL,
    'https://syria.liveuamap.com',
    'https://ukraine.liveuamap.com',
    'https://isis.liveuamap.com',
    // 'https://mideast.liveuamap.com', //paid only
    // 'https://europe.liveuamap.com',  //paid only
    // 'https://america.liveuamap.com', //paid only
    'https://asia.liveuamap.com',
    // 'https://world.liveuamap.com',   //paid only
    // 'https://africa.liveuamap.com',  //paid only
    'https://usa.liveuamap.com',
    "https://dc.liveuamap.com"
];

const UrlMappings = {
    'https://liveuamap.com': 'global',
    'https://syria.liveuamap.com': "syria",
    'https://ukraine.liveuamap.com': 'ukraine',
    'https://isis.liveuamap.com': 'isis',
    'https://asia.liveuamap.com': 'asia',
    'https://usa.liveuamap.com': 'usa',
    'https://dc.liveuamap.com': 'dc'
}


async function getExtraDetails(url) {
    return new Promise((resolve, reject) => {
        axios.get(url).then((d) => {
            const lat = d.data.split("$(document).ready(function(){")[1].split("lat")[1].split("=")[1].split("\n")[0].split(";")[0]
            const lng = d.data.split("$(document).ready(function(){")[1].split("lng")[1].split("=")[1].split("\n")[0].split(";")[0]
            const sourceLink = d.data.split('class="source-link"')[1].split("\n")[0].split("href=")[1].split("\n")[0].split(" ")[0].split('"')[1]
            const marker = d.data.split("marker-time")[1].split("data-src")[1].split('="')[1].split(">")[0].split('"')[0]
            fs.writeFile("it.html", marker, (err) => { })
            resolve({
                sourceLink: sourceLink,
                marker: marker,
                lat: lat,
                lng: lng,
            })
        }).catch(err => reject(err))
    })
}

async function getEventData(url, page, paginatedLevel) {
    const currentDate = moment().format();

    const allEventsData = [];

    var lastId = null;

    for (var i = 0; i < paginatedLevel; i++) {

        if (i >= 1) {

            try {

                const d = await axios.get(`https://liveuamap.com/ajax/do?act=prevday&id=${lastId}`);
                const v = d.data.venues;
                const lastIdS = v[0].id;
                lastId = lastIdS;
                console.log(lastId)


                const toR = [];


                v.forEach(ven => {
                    toR.push({
                        id: ven.id,
                        all: ven,
                        extra: {
                            lat: ven.lat,
                            lng: ven.lng,
                            marker: ven.picpath,
                            sourceLink: ven.source
                        },
                        posturl: ven.link,
                        meta: {
                            title: ven.name,
                            images: {
                                // total: imgs.length,
                                // sources:allImagesSource
                            },
                            // icon:t,
                            source: ven.source
                        },
                        date: {
                            scrapeDate: currentDate,
                            dateRelative: ven.time,
                        }
                    })
                })

                allEventsData.push(...toR);
                continue;

            } catch (e) {
                break;
            }

        }

        const eventData = await page.evaluate((currentDate) => {
            const events = document.querySelectorAll('.event')
            const toReturn = [];
            events.forEach(e => {
                const url = e.getAttribute("data-link");
                const dateRelative = e.querySelector(".date_add").innerHTML
                const title = e.querySelector(".title").innerText
                const imgs = e.querySelectorAll("img")
                const allImagesSource = [];

                const id = e.getAttribute("data-id");

                const t = e.querySelector(".time").innerHTML

                var source = null;
                try {
                    source = e.querySelector(".source-link").innerHTML
                } catch (e) { }

                imgs.forEach(i => {
                    allImagesSource.push(i.getAttribute('src'))
                })

                toReturn.push({
                    id: id,
                    all: e.innerHTML,
                    extra: null,
                    posturl: url,
                    meta: {
                        title: title,
                        images: {
                            total: imgs.length,
                            sources: allImagesSource
                        },
                        icon: t,
                        source: source
                    },
                    date: {
                        scrapeDate: currentDate,
                        dateRelative: dateRelative,
                    }
                })
            })

            return toReturn;
        }, currentDate)
        lastId = eventData[0].id;
        allEventsData.push(...eventData);
    }

    console.log("main scrapping done:" + UrlMappings[url]);


    //  for(var i=0;i<allEventsData.length;i++){
    //     const cur = allEventsData[i];


    //     const url = cur.posturl;

    //     const d = await getExtraDetails(url)

    //     allEventsData[i]['extra'] = d;

    //  }

    return allEventsData;
}

function checkIfAlreadyScrappedToday(url) {
    const n = UrlMappings[url];
    const currentDate = moment().format("YYYY_MM_DD");
    const path = "data/liveuamap/" + currentDate + "/" + n + ".json";


    if (!fs.existsSync(path)) {
        return false;
    }

    return true;
}


async function scrape() {

    const browser = await puppeteer.launch({
        headless: true,
        timeout: 40000
    });


    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on("request", request => {
        if (request.resourceType() == "script" || request.resourceType() == "font") {
            request.abort();
        } else {
            request.continue();
        }
    })

    for (var i = 0; i < URLs.length; i++) {
        const currentUrl = URLs[i];
        console.log(currentUrl);
    }

    for (var i = 0; i < URLs.length; i++) {
        const currentUrl = URLs[i];

        if (checkIfAlreadyScrappedToday(currentUrl)) {
            console.log("already scrapped today")
            continue;
        }

        console.log("scraping:", currentUrl);
        await page.goto(currentUrl, {
            waitUntil: 'networkidle0',
            timeout: 40000
        });

        await page.setViewport({ width: 1080, height: 1024 });

        const eventData = await getEventData(currentUrl, page, 30);

        //current date y-m-d
        const currentDate = moment().format("YYYY_MM_DD");
        //create folder if not exists

        if (!fs.existsSync("data/liveuamap/" + currentDate)) {
            fs.mkdirSync("data/liveuamap/" + currentDate);
        }

        fs.writeFileSync(`data/liveuamap/${currentDate}/${UrlMappings[currentUrl]}.json`, JSON.stringify(eventData, null, 2), (err) => { })

    }


    await page.close();
    await browser.close();

}

function sendAllFilesToS3() {
    //todo
}



scrape();