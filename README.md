# bascik

## Goals

- Create reasuble custom HTML tags aka components
- Ship zero Javascript by default
- Work within HTML spec

## Development

1. Terminal 1: `node --watch ./transpile.js`
2. Terminal 2: `npx watch-http-server dist/`

readline, transform with pipe, and transform with pipeline all seem
to be the same performance wise.

readline works well and it's great that it's line by line,
however the strength of line by line is also it's weakness.
In the case of HTML tags that are using slots, how will we look ahead?

Also, if you have a long running task in the `.on` will lines get out of order? I've tested it, and yes it does. That's unworkable.

Do transforms have the same issue?
No. The transfomer in the pipeline allowed a long running task to block the writes.
You can test by tuning the highWaterMark which is measured in kb. It appreared 1kb was one char.

Debatable if work in chunks, so we don't have the problem of look ahead.
Debtable if we should sync writes so we don't get out of order.
We could write something that looks for the things to replace after the file has been copied to dist, then calculate the number of lines that will need added.
It would be cool to do this async, but then you have to solve the problem of keeping track of how many lines each async task is adding to a file, but that might not be too hard.

I think best plan of action is to use pipleine with transformer.
The transformer looks for

I think we will have to accept you can not apply attrs directly to a custom component. Only attrs you want to have passed down.

## Scoped css styles

https://github.com/PM5544/scoped-polyfill/blob/master/readme.md

## Scoped script tag (half baked)

https://gist.github.com/dy/2124c2dfcbdd071f38e866b85436c6c5
