"use strict";

var params = URLSearchParams && new URLSearchParams(document.location.search.substring(1));
var id = params && params.get("id") && decodeURIComponent(params.get("id"));
var BOOK_ID = id;
var HISTORY_VERSION;

// Load the opf
if (id) {
    id = "/download/" + id + ".epub";
}

var prefix = (window.location.href).substring(0, window.location.href.lastIndexOf('/'));

var book = ePub(id || "https://s3.amazonaws.com/moby-dick/moby-dick.epub");
var rendition = book.renderTo("viewer", {
    width: "100%",
    height: "100%",
    stylesheet: prefix + "/inject.css"
});

rendition.display();

book.ready.then(function() {
    if (BOOK_ID) {
        makeRequest(
            "/history/get/" + BOOK_ID,
            "GET",
            function(xhr) {
                if (xhr.status !== 200) {
                    console.error("get history failed.", xhr.statusText);
                }

                var res = JSON.parse(xhr.response);
                HISTORY_VERSION = res.version;
                if (res.data != "") {
                    rendition.display(res.data);
                }
            }
        );

        setInterval(saveHistory, 10000);
    }

    rendition.on("click", function(e) {
        var windowHeight = window.innerHeight;
        var clickY = e.screenY;
        if (clickY <= 0.2 * windowHeight) {
            document.getElementsByTagName("header")[0].classList.toggle('full-screen');
        } else if (clickY <= 0.8 * windowHeight) {
            rendition.next();
        } else {
            rendition.prev();
        }
    });

    var keyListener = function(e) {
        // Left Key
        if ((e.keyCode || e.which) == 37) {
            book.package.metadata.direction === "rtl" ? rendition.next() : rendition.prev();
        }

        // Right Key
        if ((e.keyCode || e.which) == 39) {
            book.package.metadata.direction === "rtl" ? rendition.prev() : rendition.next();
        }

    };

    rendition.on("keyup", keyListener);
    document.addEventListener("keyup", keyListener, false);
});

rendition.on("rendered", function(section) {
    book.loaded.metadata.then(function(data) {
        document.title = data.title || document.title;
    });

    var current = book.navigation && book.navigation.get(section.href);
    if (current) {
        var $select = document.getElementById("toc");
        var $selected = $select.querySelector("option[selected]");
        if ($selected) {
            $selected.removeAttribute("selected");
        }

        var $options = $select.querySelectorAll("option");
        $options.forEach(function(option) {
            var selected = option.getAttribute("ref") === current.href;
            if (selected) {
                option.setAttribute("selected", "");
            }
        });
    }
});

rendition.on("relocated", function(location) {
    updateCurrentPage(location.start.cfi);
});

rendition.on("layout", function(layout) {
    var viewer = document.getElementById("viewer");

    if (layout.spread) {
        viewer.classList.remove('single');
    } else {
        viewer.classList.add('single');
    }
});

window.addEventListener("unload", function() {
    book.destroy();
});

book.loaded.navigation.then(function(toc) {
    var $select = document.getElementById("toc"),
        docfrag = document.createDocumentFragment();

    toc.forEach(function(chapter) {
        var option = document.createElement("option");
        option.textContent = chapter.label;
        option.setAttribute("ref", chapter.href);

        docfrag.appendChild(option);
    });

    $select.appendChild(docfrag);

    $select.onchange = function() {
        var index = $select.selectedIndex,
            url = $select.options[index].getAttribute("ref");
        rendition.display(url);
        return false;
    };

});

var CURRENT_PAGE = "";
var NEEDS_UPDATE = false;

var updateCurrentPage = debounce(function(page) {
    if (CURRENT_PAGE !== page) {
        CURRENT_PAGE = page;
        NEEDS_UPDATE = true;
    }
}, 250);

var saveHistory = function() {
    if (!BOOK_ID) {
        return;
    }

    if (NEEDS_UPDATE) {
        makeRequest(
            "/history/set/" + BOOK_ID,
            "POST",
            function(xhr) {
                if (xhr.status !== 201) {
                    console.error("save history failed.", xhr.statusText);
                    return;
                }
                NEEDS_UPDATE = false;

                var res = JSON.parse(xhr.response);
                HISTORY_VERSION = res.version;
            }, {
                "data": "" + CURRENT_PAGE + "",
                "version": HISTORY_VERSION
            }
        )
    }
};

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
};

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