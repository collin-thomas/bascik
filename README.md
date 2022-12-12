# bascik

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
