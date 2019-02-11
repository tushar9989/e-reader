package server

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/julienschmidt/httprouter"
	"github.com/tushar9989/e-reader/book"
	"github.com/tushar9989/e-reader/public"
	"github.com/unrolled/render"
)

// Server is a BookBrowser server.
type Server struct {
	Addr     string
	Verbose  bool
	router   *httprouter.Router
	render   *render.Render
	repo     book.Repository
	bookPath string
}

// NewServer creates a new BookBrowser server.
func NewServer(
	addr string, verbose bool, token string, historyPrefix string, bookPath string,
) *Server {
	if verbose {
		log.Printf("Supported formats: %s", ".pdf")
	}

	s := &Server{
		Addr:     addr,
		Verbose:  verbose,
		router:   httprouter.New(),
		repo:     book.NewDropboxRepository(token, historyPrefix),
		bookPath: bookPath,
	}

	s.initRender()
	s.initRouter()
	return s
}

// printLog runs log.Printf if verbose is true.
func (s *Server) printLog(format string, v ...interface{}) {
	if s.Verbose {
		log.Printf(format, v...)
	}
}

// Serve starts the BookBrowser server. It does not return unless there is an error.
func (s *Server) Serve() error {
	s.printLog("Serving on %s\n", s.Addr)
	err := http.ListenAndServe(s.Addr, s.router)
	if err != nil {
		return err
	}
	return nil
}

// initRender initializes the renderer for the BookBrowser server.
func (s *Server) initRender() {
	s.render = render.New(render.Options{
		Directory:  "templates",
		Asset:      public.Box.MustBytes,
		AssetNames: public.Box.List,
		Layout:     "base",
		Extensions: []string{".tmpl"},
		Funcs: []template.FuncMap{
			template.FuncMap{
				"raw": func(s string) template.HTML {
					return template.HTML(s)
				},
			},
		},
		IsDevelopment: false,
	})
}

// initRouter initializes the router for the BookBrowser server.
func (s *Server) initRouter() {
	s.router = httprouter.New()

	s.router.GET("/", func(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
		http.Redirect(w, r, "/books", http.StatusTemporaryRedirect)
	})

	s.router.GET("/books", s.handleBooks)
	s.router.GET("/download/:id", s.handleDownload)
	s.router.GET("/history/get/:id", s.handleHistoryGet)
	s.router.POST("/history/set/:id", s.handleHistoryUpdate)

	s.router.GET("/static/*filepath", func(w http.ResponseWriter, req *http.Request, ps httprouter.Params) {
		http.FileServer(public.Box).ServeHTTP(w, req)
	})

}

func (s *Server) handleHistoryUpdate(w http.ResponseWriter, req *http.Request, ps httprouter.Params) {
	var (
		id      string
		history book.History
		err     error
	)

	defer func() {
		if err != nil {
			handleError(w, req, err)
			return
		}
	}()

	decoder := json.NewDecoder(req.Body)
	if err = decoder.Decode(&history); err != nil {
		return
	}

	if id = ps.ByName("id"); id == "" || history.Data == "" {
		err = fmt.Errorf("invalid request")
		return
	}

	var updated book.History
	if updated, err = s.repo.WriteHistory(id, history); err != nil {
		return
	}

	var jsonBytes []byte
	if jsonBytes, err = json.Marshal(updated); err != nil {
		return
	}

	w.WriteHeader(http.StatusCreated)
	io.WriteString(w, string(jsonBytes))
}

func (s *Server) handleHistoryGet(w http.ResponseWriter, req *http.Request, ps httprouter.Params) {
	var err error

	defer func() {
		if err != nil {
			handleError(w, req, err)
			return
		}
	}()

	id := ps.ByName("id")
	if id == "" {
		err = fmt.Errorf("invalid request")
		return
	}

	var history book.History
	if history, err = s.repo.GetHistory(id); err != nil {
		return
	}

	var jsonBytes []byte
	if jsonBytes, err = json.Marshal(history); err != nil {
		return
	}

	io.WriteString(w, string(jsonBytes))
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	id = strings.TrimRight(id, ".epub")
	book, data, err := s.repo.Download(id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	defer data.Close()

	w.Header().Set("Cache-Control", "max-age=2592000")
	w.Header().Set(
		"Content-Disposition", `attachment; filename="`+regexp.MustCompile("[[:^ascii:]]").ReplaceAllString(book.Name, "_")+`"`,
	)

	if book.IsPDF {
		w.Header().Set("Content-Type", "application/pdf")
	} else {
		w.Header().Set("Content-Type", "application/epub")
	}

	_, err = io.Copy(w, data)
	if err != nil {
		log.Printf("error writing data for request for %s: %v\n", r.URL.Path, err)
		return
	}

	return
}

func (s *Server) handleBooks(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	bl, err := s.repo.List(s.bookPath)
	if err != nil {
		handleError(w, r, err)
		return
	}

	s.render.HTML(w, http.StatusOK, "books", map[string]interface{}{
		"PageTitle":        "Books",
		"ShowViewSelector": true,
		"Title":            "",
		"Books":            bl,
	})
}

func handleError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	io.WriteString(w, fmt.Sprintf("error handling request. reason: %v", err))
	log.Printf("error handling request for %s: %v\n", r.URL.Path, err)
}
