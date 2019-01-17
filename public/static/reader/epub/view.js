"use strict";

var params = URLSearchParams && new URLSearchParams(document.location.search.substring(1));
var id = params && params.get("id") && decodeURIComponent(params.get("id"));
var bookHistory;

// Load the opf
if (id) {
    bookHistory = new History(id);
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
    if (!bookHistory) {
        return;
    }

    bookHistory.update(location.start.cfi);
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
