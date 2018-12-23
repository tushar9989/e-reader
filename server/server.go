package server

import (
	"html/template"
	"io"
	"log"
	"net/http"
	"regexp"

	"github.com/geek1011/BookBrowser/books"
	"github.com/geek1011/BookBrowser/public"
	"github.com/julienschmidt/httprouter"
	"github.com/unrolled/render"
)

// Server is a BookBrowser server.
type Server struct {
	Token   string
	Addr    string
	Verbose bool
	router  *httprouter.Router
	render  *render.Render
}

// NewServer creates a new BookBrowser server. It will not index the books automatically.
func NewServer(addr string, verbose bool, token string) *Server {
	books.SetClient(token)

	if verbose {
		log.Printf("Supported formats: %s", ".pdf")
	}

	s := &Server{
		Token:   token,
		Addr:    addr,
		Verbose: verbose,
		router:  httprouter.New(),
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
		http.Redirect(w, r, "/books/", http.StatusTemporaryRedirect)
	})

	s.router.GET("/books", s.handleBooks)
	s.router.GET("/books/:name", s.handleBook)

	s.router.GET("/download/:name", s.handleDownload)

	s.router.GET("/static/*filepath", func(w http.ResponseWriter, req *http.Request, ps httprouter.Params) {
		http.FileServer(public.Box).ServeHTTP(w, req)
	})
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	name := p.ByName("name")
	book := books.Book{
		Name: name,
		Path: "/books/" + name,
	}

	rd, err := book.Download()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, "Error handling request")
		log.Printf("Error handling request for %s: %s\n", r.URL.Path, err)
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000")
	w.Header().Set("Content-Disposition", `attachment; filename="`+regexp.MustCompile("[[:^ascii:]]").ReplaceAllString(book.Name, "_")+`"`)
	w.Header().Set("Content-Type", "application/pdf")
	_, err = io.Copy(w, rd)
	rd.Close()
	if err != nil {
		log.Printf("Error handling request for %s: %s\n", r.URL.Path, err)
	}
	return
}

func (s *Server) handleBooks(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	bl, err := books.Get("/books")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, "Error handling request")
		log.Printf("Error handling request for %s: %s\n", r.URL.Path, err)
		return
	}

	s.render.HTML(w, http.StatusOK, "books", map[string]interface{}{
		"PageTitle":        "Books",
		"ShowViewSelector": true,
		"Title":            "",
		"Books":            bl,
	})
}

func (s *Server) handleBook(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	name := p.ByName("name")
	s.render.HTML(w, http.StatusOK, "book", map[string]interface{}{
		"PageTitle":        name,
		"ShowViewSelector": false,
		"Title":            "",
		"Book": books.Book{
			Name: name,
			Path: "/books/" + name,
		},
	})
	return
}
