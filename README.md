edx Introduction to NodeJS: Assignment 3
=====

This project is my solution to the 3rd assignment at edX Introduction to Node.js course.

https://courses.edx.org/courses/course-v1:Microsoft+DEV283x+2T2018/course/

It merges the customers data and relevant addresses and insert the entries in a mongodb database. 
Optionally, it check if an entry already exists and insert or update the entry accordingly.

```
$ node . [chunk size] [--check-duplicates]
```

### 1. Why did I design this project the way I did?

It was requested to use the mongodb native driver and async modules, running a number of queries in parallel, depending on the number of object to process in a single query provided from a CLI argument.

I added the possibility to check if an entry already exists in the db and insert or update such entry accordingly (batch inserts would create 1000 new duplicate entries at every execution, dropping the collection before inserting the data could have been another option). 

### 2. How did I test?

I checked the entries of the mongodb, everything looked ok. 

### 3. Known issues

* the insertOrUpdate function could possibly be optimized.
 