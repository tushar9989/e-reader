"use strict";

var params = URLSearchParams && new URLSearchParams(document.location.search.substring(1));
var id = params && params.get("id") && decodeURIComponent(params.get("id"));
var bookHistory;
var FIRST_LOAD_DONE = false;
var FONT_SIZE = "100%";
var DICTIONARY_VISIBLE = false;

// Load the opf
if (id) {
    bookHistory = new History(id);
    id = "/download/" + id + ".epub";
}

var book = ePub(id || "https://s3.amazonaws.com/moby-dick/moby-dick.epub");
var rendition = book.renderTo("viewer", {
    width: "100%",
    height: "100%"
});

var prefix = (window.location.href).substring(0, window.location.href.lastIndexOf('/'));
rendition.themes.register("inject", prefix + "/inject.css");
rendition.themes.select("inject");

function updateFontSize(value) {
    var percentage = +value;
    if (percentage == NaN || percentage < 50 || percentage > 200) {
        return;
    }

    FONT_SIZE = percentage + "%";
    if (rendition) {
        rendition.themes.fontSize(FONT_SIZE);
        if (FIRST_LOAD_DONE && bookHistory) {
            rendition.display(bookHistory.currentPage());
        }
    }
}

document.getElementById("font-size").addEventListener("input", function(input) {
    updateFontSize(input.target.value);
    localStorage.setItem('font-size', input.target.value);
});

if (localStorage.getItem('font-size')) {
    updateFontSize(localStorage.getItem('font-size'));
    document.getElementById("font-size").value = +localStorage.getItem('font-size');
}

function dictionaryCallback(response) {
    try {
        var meanings = [];
        if (response.tuc && 
            response.tuc.length > 0) {
            for (let i = 0; i < response.tuc.length; i++) {
                if (response.tuc[i].meanings && 
                    response.tuc[i].meanings.length > 0) {
                    for (let j = 0; j < response.tuc[i].meanings.length; j++) {
                        meanings.push(response.tuc[i].meanings[j].text);
                    }
                }
            }
        }

        let hasResults = true;
        if (meanings.length == 0) {
            meanings.push("Not found");
            hasResults = false;
        }

        let meaning = document.getElementById("meaning");
        meaning.style.fontSize = FONT_SIZE;
        let current = 0;
        meaning.onclick = function(e) {
            let x = 0.5;
            try {
                x = (e.x - e.target.parentNode.offsetLeft) / e.target.clientWidth;
            } catch(err) { }

            if (x <= 0.4) {
                current--;
                if (current < 0) {
                    current = 0;
                }
            } else if (x >= 0.6) {
                current++;
                if (current >= meanings.length) {
                    current = meanings.length - 1;
                }
            }
            
            let prefix = "";
            if (hasResults) {
                prefix = "<b>" + (current + 1) + " of  " + (meanings.length) + "</b> ";
            }

            meaning.innerHTML = prefix + meanings[current];
        }

        meaning.onclick();
        document.getElementById("dict").classList.add("visible");
        DICTIONARY_VISIBLE = true;
    } catch (error) {
        console.error(error);
    }
}

let SELECTION_CALLED = false;
let dictionaryHandler = debounce(function(range, contents) {
    SELECTION_CALLED = false;
    try {
        let bounds = contents.window.getSelection().getRangeAt(0).getBoundingClientRect();
        let top = bounds.top + bounds.height
        if (top + 110 >= window.innerHeight) {
            top = bounds.top - 100;
        }

        top = Math.ceil(top + 0.3);
        document.getElementById("dict").style.top = top + "px";
        let text = contents.window.getSelection().getRangeAt(0).cloneContents().textContent;
        
        // Remove punctuations.
        text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()“”]/g,"");
        
        // Remove extra spaces.
        text = text.replace(/\s{2,}/g," ");
        
        // Convert to lower case.
        text = text.toLowerCase();

        // Trim spaces
        text = text.trim();

        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = "https://glosbe.com/gapi/translate?from=eng&dest=eng&format=json&phrase=" + encodeURIComponent(text) + "&callback=dictionaryCallback";
        document.head.appendChild(script);
    } catch (error) {
        console.error(error);
    } 
}, 1000);

book.ready.then(function() {
    if (bookHistory) {
        bookHistory.get().then(
            function(page) {
                rendition.display(page);
            },
            function(response) {
                console.error(response);
                rendition.display();
            }
        )
    } else {
        rendition.display();
    }

    rendition.on("click", function(e) {
        if (DICTIONARY_VISIBLE) {
            document.getElementById("dict").classList.remove("visible");
            DICTIONARY_VISIBLE = false;
            return;
        }

        var container = rendition.manager.container;
        var clickX = e.clientX - container.scrollLeft;
        var clickY = e.clientY - container.scrollTop;

        setTimeout(function() {
            if (SELECTION_CALLED) {
                return;
            }

            if (clickY <= 0.3 * window.innerHeight) {
                document.getElementsByTagName("header")[0].classList.toggle('full-screen');
            } else if (clickX > 0.20 * window.innerWidth) {
                rendition.next();
                PAGE_CHANGED = true;
            } else {
                rendition.prev();
                PAGE_CHANGED = true;
            }
        }, 250);
    });

    rendition.on("selected", function(range, contents) {
        SELECTION_CALLED = true;
        dictionaryHandler(range, contents);
    });

    var keyListener = function(e) {
        // Left Key
        if ((e.keyCode || e.which) == 37) {
            rendition.prev();
            PAGE_CHANGED = true;
        }

        // Right Key
        if ((e.keyCode || e.which) == 39) {
            rendition.next();
            PAGE_CHANGED = true;
        }
    };

    rendition.on("keyup", keyListener);
});

var PAGE_CHANGED = false;
rendition.on("relocated", function(location) {
    if (!FIRST_LOAD_DONE) {
        FIRST_LOAD_DONE = true;
        // Does not work correctly after changing the font size for some books.
        // Doing it again to make sure that the desired page is displayed. 
        if (bookHistory && location.start.cfi != bookHistory.currentPage()) {
            rendition.display(bookHistory.currentPage());
        }

        return;
    }

    if (PAGE_CHANGED) {
        if (!resizeTimeout) {
            if (rendition && bookHistory) {
                bookHistory.update(location.start.cfi);
            }
        }
        PAGE_CHANGED = false;
    }
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

var resizeTimeout;
rendition.on("resized", function() {
    if (rendition && bookHistory) {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }

        resizeTimeout = setTimeout(function() {
            rendition.display(bookHistory.currentPage());
            resizeTimeout = undefined;
        }, 500);
    }
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
