FROM golang:alpine
WORKDIR /go/src/github.com/geek1011/BookBrowser
COPY . .
RUN go build
ENTRYPOINT ["/go/src/github.com/geek1011/BookBrowser/BookBrowser"]
