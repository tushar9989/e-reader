"use strict";

function step(isUp) {
    var elem = this.parentNode.querySelector('input[type=number]');
    if (isUp) {
        elem.stepUp();
    } else {
        elem.stepDown(); 
    }

    var evt = document.createEvent('HTMLEvents');
    evt.initEvent('input', true, true);
    elem.dispatchEvent(evt);
}