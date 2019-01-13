/* Copyright 2016 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals pdfjsLib, pdfjsViewer */

'use strict';

if (!pdfjsLib.getDocument || !pdfjsViewer.PDFViewer) {
  alert('Please build the pdfjs-dist library using\n `gulp dist-install`');
}

var USE_ONLY_CSS_ZOOM = false;
var TEXT_LAYER_MODE = 0; // DISABLE
var MAX_IMAGE_SIZE = 1024 * 1024 * 100;
var CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.0.943/cmaps/';
var CMAP_PACKED = true;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.0.943/build/pdf.worker.js';

var DEFAULT_SCALE_DELTA = 1.1;
var MIN_SCALE = 0.25;
var MAX_SCALE = 10.0;
var DEFAULT_SCALE_VALUE = 'auto';
var BOOK_ID = findGetParameter("id");
var DEFAULT_URL = '../reader/pdf/web/compressed.tracemonkey-pldi-09.pdf';

if (BOOK_ID !== null) {
  DEFAULT_URL = '/download/' + BOOK_ID;
}

function toggleFullscreen() {
  document.getElementById("viewerContainer").classList.toggle('full-screen');
  document.getElementsByTagName("header")[0].classList.toggle('full-screen');
  document.getElementsByTagName("footer")[0].classList.toggle('full-screen');
}

document.getElementById('viewerContainer').addEventListener('click', function() {
  toggleFullscreen();
});

toggleFullscreen();

var PDFViewerApplication = {
  pdfLoadingTask: null,
  pdfDocument: null,
  pdfViewer: null,
  pdfHistory: null,
  pdfLinkService: null,

  /**
   * Opens PDF document specified by URL.
   * @returns {Promise} - Returns the promise, which is resolved when document
   *                      is opened.
   */
  open: function(params) {
    if (this.pdfLoadingTask) {
      // We need to destroy already opened document
      return this.close().then(function () {
        // ... and repeat the open() call.
        return this.open(params);
      }.bind(this));
    }

    var url = params.url;
    var self = this;
    this.setTitleUsingUrl(url);

    // Loading document.
    var loadingTask = pdfjsLib.getDocument({
      url: url,
      maxImageSize: MAX_IMAGE_SIZE,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
      httpHeaders: {
        "Cache-Control": "max-age=2592000"
      }
    });
    this.pdfLoadingTask = loadingTask;

    loadingTask.onProgress = function (progressData) {
      self.progress(progressData.loaded / progressData.total);
    };

    return loadingTask.promise.then(function (pdfDocument) {
      // Document loaded, specifying document for the viewer.
      self.pdfDocument = pdfDocument;
      self.pdfViewer.setDocument(pdfDocument);
      self.pdfLinkService.setDocument(pdfDocument);
      self.pdfHistory.initialize(pdfDocument.fingerprint);

      self.loadingBar.hide();
      self.setTitleUsingMetadata(pdfDocument);
    }, function (exception) {
      var message = exception && exception.message;
      var loadingErrorMessage;

      if (exception instanceof pdfjsLib.InvalidPDFException) {
        loadingErrorMessage = 'Invalid or corrupted PDF file.';
      } else if (exception instanceof pdfjsLib.MissingPDFException) {
        loadingErrorMessage = 'Missing PDF file.';
      } else if (exception instanceof pdfjsLib.UnexpectedResponseException) {
        loadingErrorMessage = 'Unexpected server response.';
      } else {
        loadingErrorMessage = 'An error occurred while loading the PDF.';
      }

      loadingErrorMessage.then(function (msg) {
        self.error(msg, { message: message, });
      });
      self.loadingBar.hide();
    });
  },

  /**
   * Closes opened PDF document.
   * @returns {Promise} - Returns the promise, which is resolved when all
   *                      destruction is completed.
   */
  close: function() {
    var errorWrapper = document.getElementById('errorWrapper');
    errorWrapper.setAttribute('hidden', 'true');

    if (!this.pdfLoadingTask) {
      return Promise.resolve();
    }

    var promise = this.pdfLoadingTask.destroy();
    this.pdfLoadingTask = null;

    if (this.pdfDocument) {
      this.pdfDocument = null;

      this.pdfViewer.setDocument(null);
      this.pdfLinkService.setDocument(null, null);
    }

    return promise;
  },

  get loadingBar() {
    var bar = new pdfjsViewer.ProgressBar('#loadingBar', {});

    return pdfjsLib.shadow(this, 'loadingBar', bar);
  },

  setTitleUsingUrl: function pdfViewSetTitleUsingUrl(url) {
    this.url = url;
    var title = pdfjsLib.getFilenameFromUrl(url) || url;
    try {
      title = decodeURIComponent(title);
    } catch (e) {
      // decodeURIComponent may throw URIError,
      // fall back to using the unprocessed url in that case
    }
    this.setTitle(title);
  },

  setTitleUsingMetadata: function(pdfDocument) {
    var self = this;
    pdfDocument.getMetadata().then(function(data) {
      var info = data.info, metadata = data.metadata;
      self.documentInfo = info;
      self.metadata = metadata;

      // Provides some basic debug information
      console.log('PDF ' + pdfDocument.fingerprint + ' [' +
                  info.PDFFormatVersion + ' ' + (info.Producer || '-').trim() +
                  ' / ' + (info.Creator || '-').trim() + ']' +
                  ' (PDF.js: ' + (pdfjsLib.version || '-') + ')');

      var pdfTitle;
      if (metadata && metadata.has('dc:title')) {
        var title = metadata.get('dc:title');
        // Ghostscript sometimes returns 'Untitled', so prevent setting the
        // title to 'Untitled.
        if (title !== 'Untitled') {
          pdfTitle = title;
        }
      }

      if (!pdfTitle && info && info['Title']) {
        pdfTitle = info['Title'];
      }

      if (pdfTitle) {
        self.setTitle(pdfTitle + ' - ' + document.title);
      }
    });
  },

  setTitle: function pdfViewSetTitle(title) {
    document.title = title;
    document.getElementById('title').textContent = title;
  },

  error: function pdfViewError(message, moreInfo) {
    var l10n = this.l10n;
    var moreInfoText = [l10n.get('error_version_info',
      { version: pdfjsLib.version || '?',
        build: pdfjsLib.build || '?', },
      'PDF.js v{{version}} (build: {{build}})')];

    if (moreInfo) {
      moreInfoText.push(
        l10n.get('error_message', { message: moreInfo.message, },
          'Message: {{message}}'));
      if (moreInfo.stack) {
        moreInfoText.push(
          l10n.get('error_stack', { stack: moreInfo.stack, },
            'Stack: {{stack}}'));
      } else {
        if (moreInfo.filename) {
          moreInfoText.push(
            l10n.get('error_file', { file: moreInfo.filename, },
              'File: {{file}}'));
        }
        if (moreInfo.lineNumber) {
          moreInfoText.push(
            l10n.get('error_line', { line: moreInfo.lineNumber, },
              'Line: {{line}}'));
        }
      }
    }

    var errorWrapper = document.getElementById('errorWrapper');
    errorWrapper.removeAttribute('hidden');

    var errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;

    var closeButton = document.getElementById('errorClose');
    closeButton.onclick = function() {
      errorWrapper.setAttribute('hidden', 'true');
    };

    var errorMoreInfo = document.getElementById('errorMoreInfo');
    var moreInfoButton = document.getElementById('errorShowMore');
    var lessInfoButton = document.getElementById('errorShowLess');
    moreInfoButton.onclick = function() {
      errorMoreInfo.removeAttribute('hidden');
      moreInfoButton.setAttribute('hidden', 'true');
      lessInfoButton.removeAttribute('hidden');
      errorMoreInfo.style.height = errorMoreInfo.scrollHeight + 'px';
    };
    lessInfoButton.onclick = function() {
      errorMoreInfo.setAttribute('hidden', 'true');
      moreInfoButton.removeAttribute('hidden');
      lessInfoButton.setAttribute('hidden', 'true');
    };
    moreInfoButton.removeAttribute('hidden');
    lessInfoButton.setAttribute('hidden', 'true');
    Promise.all(moreInfoText).then(function (parts) {
      errorMoreInfo.value = parts.join('\n');
    });
  },

  progress: function pdfViewProgress(level) {
    var percent = Math.round(level * 100);
    // Updating the bar if value increases.
    if (percent > this.loadingBar.percent || isNaN(percent)) {
      this.loadingBar.percent = percent;
    }
  },

  get pagesCount() {
    return this.pdfDocument.numPages;
  },

  set page(val) {
    this.pdfViewer.currentPageNumber = val;
  },

  get page() {
    return this.pdfViewer.currentPageNumber;
  },

  zoomIn: function pdfViewZoomIn(ticks) {
    var newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.ceil(newScale * 10) / 10;
      newScale = Math.min(MAX_SCALE, newScale);
    } while (--ticks && newScale < MAX_SCALE);
    this.pdfViewer.currentScaleValue = newScale;
  },

  zoomOut: function pdfViewZoomOut(ticks) {
    var newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.floor(newScale * 10) / 10;
      newScale = Math.max(MIN_SCALE, newScale);
    } while (--ticks && newScale > MIN_SCALE);
    this.pdfViewer.currentScaleValue = newScale;
  },

  initUI: function pdfViewInitUI() {
    var linkService = new pdfjsViewer.PDFLinkService();
    this.pdfLinkService = linkService;

    this.l10n = pdfjsViewer.NullL10n;

    var container = document.getElementById('viewerContainer');
    var pdfViewer = new pdfjsViewer.PDFViewer({
      container: container,
      linkService: linkService,
      l10n: this.l10n,
      useOnlyCssZoom: USE_ONLY_CSS_ZOOM,
      textLayerMode: TEXT_LAYER_MODE,
    });
    this.pdfViewer = pdfViewer;
    linkService.setViewer(pdfViewer);

    this.pdfHistory = new pdfjsViewer.PDFHistory({
      linkService: linkService,
    });
    linkService.setHistory(this.pdfHistory);

    document.getElementById('previous').addEventListener('click', function() {
      PDFViewerApplication.page--;
    });

    document.getElementById('next').addEventListener('click', function() {
      PDFViewerApplication.page++;
    });

    document.getElementById('zoomIn').addEventListener('click', function() {
      PDFViewerApplication.zoomIn();
    });

    document.getElementById('zoomOut').addEventListener('click', function() {
      PDFViewerApplication.zoomOut();
    });

    document.getElementById('pageNumber').addEventListener('click', function() {
      this.select();
    });

    document.getElementById('pageNumber').addEventListener('change',
        function() {
      PDFViewerApplication.page = (this.value | 0);

      // Ensure that the page number input displays the correct value,
      // even if the value entered by the user was invalid
      // (e.g. a floating point number).
      if (this.value !== PDFViewerApplication.page.toString()) {
        this.value = PDFViewerApplication.page;
      }
    });

    document.addEventListener('pagesinit', function () {
      // We can use pdfViewer now, e.g. let's change default scale.
      pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
      PDFViewerApplication.page = 1;

      makeRequest(
        "/history/get/" + BOOK_ID,
        "GET",
        function(xhr) {
          if (xhr.status !== 200) {
            console.error("get history failed.", xhr.statusText);
          }

          var PAGE = +xhr.response;
          if (PAGE != NaN && PAGE > 1) {
            PDFViewerApplication.page = PAGE;
            CURRENT_PAGE = PAGE;
          }
        }
      )

      setInterval(saveHistory, 10000);
    });

    document.addEventListener('updateviewarea', function (evt) {
      var page = evt.location.pageNumber;
      var numPages = PDFViewerApplication.pagesCount;

      document.getElementById('pageNumber').value = page;
      document.getElementById('previous').disabled = (page <= 1);
      document.getElementById('next').disabled = (page >= numPages);

      updateCurrentPage(page);
    }, true);
  },
};

document.addEventListener('DOMContentLoaded', function () {
  PDFViewerApplication.initUI();
}, true);

(function animationStartedClosure() {
  // The offsetParent is not set until the PDF.js iframe or object is visible.
  // Waiting for first animation.
  PDFViewerApplication.animationStartedPromise = new Promise(
    function (resolve) {
      window.requestAnimationFrame(resolve);
    });
})();

// We need to delay opening until all HTML is loaded.
PDFViewerApplication.animationStartedPromise.then(function () {
  PDFViewerApplication.open({
    url: DEFAULT_URL,
  });
});

var CURRENT_PAGE = 1;
var NEEDS_UPDATE = false;

var updateCurrentPage = debounce(function(page) {
  if (CURRENT_PAGE !== page) {
    CURRENT_PAGE = page;
    NEEDS_UPDATE = true;
  }
}, 250);

var saveHistory = function() {
  if (NEEDS_UPDATE) {
    makeRequest(
      "/history/set/" + BOOK_ID + "/" + CURRENT_PAGE,
      "POST",
      function(xhr) {
        if (xhr.status !== 201) {
          console.error("save history failed.", xhr.statusText);
        }
        NEEDS_UPDATE = false;
      }
    )
  }
};

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
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

function findGetParameter(parameterName) {
  var result = null,
      tmp = [];
  location.search
      .substr(1)
      .split("&")
      .forEach(function (item) {
        tmp = item.split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
      });
  return result;
}

function makeRequest(url, method, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.onload = function () {
    if (xhr.readyState === 4) {
      callback(xhr);
    } else {
      console.error(xhr.statusText);
    }
  };
  xhr.onerror = function () {
    console.error(xhr.statusText);
  };
  xhr.send(null);
}