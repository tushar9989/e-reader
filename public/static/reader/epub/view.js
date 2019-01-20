"use strict";

var params = URLSearchParams && new URLSearchParams(document.location.search.substring(1));
var id = params && params.get("id") && decodeURIComponent(params.get("id"));
var bookHistory;

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

    if (rendition) {
        rendition.themes.fontSize(percentage + "%");
        if (bookHistory) {
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

rendition.display();

book.ready.then(function() {
    if (bookHistory) {
        bookHistory.get().then(
            function(page) {
                rendition.display(page);
            },
            function(response) {
                console.error(response);
            }
        )
    }

    rendition.on("click", function(e) {
        var container = rendition.manager.container;
        var clickX = e.clientX - container.scrollLeft;
        var clickY = e.clientY - container.scrollTop;
        if (clickY <= 0.2 * window.innerHeight) {
            document.getElementsByTagName("header")[0].classList.toggle('full-screen');
        } else if (clickX > 0.15 * window.innerWidth) {
            rendition.next();
            PAGE_CHANGED = true;
        } else {
            rendition.prev();
            PAGE_CHANGED = true;
        }
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
