"use strict";

function History(BOOK_ID) {
    if (BOOK_ID == "") {
        return undefined;
    }
    
    var NEEDS_UPDATE = false;
    var HISTORY_VERSION;
    var CURRENT_PAGE;
    const INTERVAL = 10000;

    this.update = debounce(function(page) {
        if (CURRENT_PAGE !== page) {
            CURRENT_PAGE = page;
            NEEDS_UPDATE = true;
        }
    }, 500);

    this.currentPage = function() {
        return CURRENT_PAGE;
    }

    this.get = function() {
        return new Promise(
            (resolve, reject) => {
                makeRequest(
                    "/history/get/" + BOOK_ID,
                    "GET",
                    function(xhr) {
                        if (xhr.status !== 200) {
                            reject("get history failed. reason: " + xhr.statusText);

                            var snackbar = document.getElementById("snackbar");
                            snackbar.classList.toggle('show');
                            snackbar.innerHTML = "get history failed. message: " + xhr.response;
                            setTimeout(function(){ 
                                snackbar.classList.toggle('show');
                            }, 5000);
                            return;
                        }
        
                        var res = JSON.parse(xhr.response);
                        HISTORY_VERSION = res.version;
                        if (res.data) {
                            CURRENT_PAGE = res.data;
                            resolve(res.data);
                        }
                        
                        setTimeout(save, INTERVAL);
                    }
                );
            }
        );
    }

    function save() {
        if (!NEEDS_UPDATE) {
            setTimeout(save, INTERVAL);
            return;
        }

        makeRequest(
            "/history/set/" + BOOK_ID,
            "POST",
            function(xhr) {
                if (xhr.status !== 201) {
                    var snackbar = document.getElementById("snackbar");
                    snackbar.classList.toggle('show');
                    snackbar.innerHTML = "save history failed. message: " + xhr.response;

                    console.error("save history failed.", xhr.statusText);
                    return;
                }

                NEEDS_UPDATE = false;
                HISTORY_VERSION = JSON.parse(xhr.response).version;
                setTimeout(save, 10000);
            }, {
                "data": CURRENT_PAGE + "",
                "version": HISTORY_VERSION
            }
        )
    }

    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this,
                args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    function makeRequest(url, method, callback, data) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.onload = function() {
            if (xhr.readyState === 4) {
                callback(xhr);
            } else {
                console.error(xhr.statusText);
            }
        };

        xhr.onerror = function() {
            console.error(xhr.statusText);
        };

        if (data == undefined) {
            xhr.send(null);
        } else {
            xhr.send(JSON.stringify(data))
        }
    }
}