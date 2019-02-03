package main

import (
	"log"
	"strings"

	"github.com/tushar9989/e-reader/server"
	"github.com/spf13/pflag"
)

func main() {
	bookDir := pflag.StringP("bookdir", "b", "/books", "the dropbox directory to load books from")
	history := pflag.StringP("historydir", "h", "/history", "the dropbox directory to save the history to")
	token := pflag.StringP("token", "t", "DROPBOX_TOKEN", "the dropbox token")
	addr := pflag.StringP("addr", "a", ":8090", "the address to bind the server to ([IP]:PORT)")
	pflag.Parse()

	if !strings.Contains(*addr, ":") {
		log.Fatalln("Error: invalid listening address")
	}

	s := server.NewServer(*addr, true, *token, *history, *bookDir)
	if err := s.Serve(); err != nil {
		log.Fatalf("Error starting server: %s\n", err)
	}
}
