let COLORTHEME;

let THEMECOLORS = {
    textcolor: '#1b1b1d',
    background: 'white',
    upPrimary: 'rgba(0,200,5,1)',
    upLight: 'rgba(0,200,5,0.1)', 
    downPrimary: 'rgba(255,80,0,1)', 
    downLight: 'rgba(255,80,0,0.1)'
}

function isLight(color) {
    if (color.match(/^rgb/)) {
        color = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
        r = color[1];
        g = color[2];
        b = color[3];
    }
    else {
        color = +("0x" + color.slice(1).replace(color.length < 5 && /./g, '$&$&'));
        r = color >> 16;
        g = color >> 8 & 255;
        b = color & 255;
    }
    hsp = Math.sqrt(
      0.299 * (r * r) +
      0.587 * (g * g) +
      0.114 * (b * b)
    );
    return (hsp>127.5);
}

function checkTheme(upPrim, downPrim) {
    return (upPrim === THEMECOLORS.upPrimary && downPrim === THEMECOLORS.downPrimary);
}

function setTheme(dark) {
    COLORTHEME = (dark) ? 'dark' : 'light';
    if(COLORTHEME === 'dark') {
        $('.table').addClass('table-dark');
    } else {
        $('.table').removeClass('table-dark');
    }
    // chrome.storage.sync.get(['colors'], (obj) => {
        // let [background, textcolor, a, b, upPrim, none, downPrim, none2] = obj.colors;
        // background = background.match(/^rgb.*\)/gi)[0];
        let background = THEMECOLORS.background;
        let textcolor = THEMECOLORS.textcolor;
        // checkTheme(upPrim, downPrim);
        let color = dark ? background : textcolor;
        let backgroundColor = dark ? textcolor : background;
        $('html').get(0).style.setProperty('--time-based-color', backgroundColor);
        $('html').get(0).style.setProperty('--time-based-font-color', color);
        chrome.storage.sync.set({colors: [background, textcolor]});
    // });
}

function setGainTheme(up) {
    let norm = up ? THEMECOLORS.upPrimary : THEMECOLORS.downPrimary;
    let light = up ? THEMECOLORS.upLight : THEMECOLORS.downLight;
    $('html').get(0).style.setProperty('--robin-color-1', norm);
    $('html').get(0).style.setProperty('--individual-charts-header-color', norm);
    $('html').get(0).style.setProperty('--robin-color-light', light);
}

function setTableTheme() {
    // $('.table').removeClass('table-hover');
    let fn = COLORTHEME === 'light' ? 'removeClass' : 'addClass';
    $('.table')[fn]('table-dark');
}

export {
    setGainTheme,
    setTableTheme,
    THEMECOLORS,
    COLORTHEME,
    setTheme,
    checkTheme,
}