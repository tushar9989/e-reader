package main

import (
	"log"
	"strings"

	"github.com/geek1011/BookBrowser/server"
	"github.com/spf13/pflag"
)

var curversion = "dev"

func main() {
	_ = pflag.StringP("bookdir", "b", "/books", "the dropbox directory to load books from")
	//token := pflag.StringP("token", "t", "DROPBOX_TOKEN", "the dropbox token")
	token := pflag.StringP("token", "t", "iLXaZH3kP1oAAAAAAAALt6_X4ro-8qn6IPMNg9UeylKpSBUEYCDa8A4O3jTwJoG6", "the dropbox token")
	addr := pflag.StringP("addr", "a", ":8090", "the address to bind the server to ([IP]:PORT)")
	pflag.Parse()

	if !strings.Contains(*addr, ":") {
		log.Fatalln("Error: invalid listening address")
	}

	s := server.NewServer(*addr, true, *token)

	err := s.Serve()
	if err != nil {
		log.Fatalf("Error starting server: %s\n", err)
	}
}
