const express = require("express");
const mongoose = require("mongoose");
const app = express();
const fs = require("fs");
const port = 8080;
const cookieParser = require("cookie-parser");
const chalk = require("chalk");
const rateLimit = require("express-rate-limit")
const handlebars = require("express-handlebars");

//Ограничение на время ожидания ответа от сервера
const limiter = rateLimit({
  windowMs: 2*60*1000,
  max: 10
});

//настройка куки на хранение до 1 часа
var cookieOptions = {
  path: "/",
  httpOnly: true,
  maxAge: 60 * 60 * 1000,
};
//Подключение парсера пост запроса и парсера куки, а так же статическую папку паблик и ограничение времени ожидания на tableadd
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/tableadd",limiter);
app.use(express.static("public"));
//Установка движка рендера
app.set("view engine", "hbs");

app.engine(
  "hbs",
  handlebars({
    layoutsDir: __dirname + "/views/layouts",
    extname: "hbs",
  })
);

//Подключение к базе данных по ссылке из config
mongoose.connect(require('./config.js').databaselink,
  { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Hello db");
    }
  }
);

//Настройка схемы таблицы для новостей в базу данных
var news = mongoose.model(
  "NewsTable",
  mongoose.Schema({
    title: String,
    info: String,
  })
);

//Промежуточное ПО для проверки аутентификации пользователя
const isAuth = (req, res, next) => {
  console.log("Auth");
  console.log(req.cookies["isLogin"]);
  if (req.cookies["isLogin"] == 'true') {
    next();
    return;
  }
  return res.redirect('/login');
};

//Папка временного хранения пользователей. Основной массив пользователей хранится в users.json
var users = [ ];

//REST API для таблицы новостей

//Удаление всех новостей из базы данных
app.delete("/drop",(req,res)=>
{
  console.log("cleared");
  news.collection.deleteMany();
  res.send({
    asd: "asd",
  });
});


//Добавление новостей в базу данных
app.put("/tableadd", (req, res) => {
  console.log("I'm here!" + req.body.title + "   " + req.body.info);
  var n = new news();
  n.title = req.body.title;
  n.info = req.body.info;
  news.findOne({ title: n.title }, (err, news) => {
    if (news) {
      console.log(news);
    } else {
      n.save();
    }
  });
  res.send({
    asd: "asd",
  });
});

//Удаление новостей из базы данных. Удаление происходит по айди, для этого на фронте каждой кнопке соотносится айди конкретного элемента
app.delete("/tabledelete", (req, res) => {
  console.log(req.body.id);
  if (req.body.id != undefined) {
    news.deleteOne({ _id: req.body.id }, (err, n) => {
      if (n) {
        console.log("deleted: \n" + n);
      }
      return res.send(n);
    });
  } else {
    newss.title = req.body.title;
    newss.info = req.body.info;
    news.deleteOne({ title: newss.title }, (err, news) => {
      if (news) {
        console.log("found");
        newss.delete();
      }
    });
  }
  console.log("check DB!");
});
//Выдача по ссылке новостей может производится только для авторизированных пользователей.Функция isAuth. Так же здесь обрабатывается поиск по базе данных
//Если в поле с поиском что-то есть, то мы производим поиск по req.query.search
app.get("/tableget", isAuth, (req, res) => {
  console.log(chalk.red("Cookie:") + chalk.blue(req?.cookies["isLogin"]));
  console.log(req.query.search);
  var search = {};
  if (req.query.search != undefined && req.query.search != "")
    search = {
      //Создаем регулярное выражение для поиска всех совпадений
      title: new RegExp(req.query.search + "*", "g"),
    };
  news
    .find(search)
    .lean()
    .exec((err, data) => {
      res.render("9lab", { layout: "fourd", table: data });
    });
});


//Выдача домашней страницы
app.get("/", (req, res) => {
  if(req.cookies['isLogin'] == 'true'){
    res.redirect('/tableget');
  }
  res.render("home", { layout: "fourd" });
});
//Выдача страницы взода

app.get("/login", (req, res) => {
  res.render("login", { layout: "fourd" });
});

//Получение данных со страницы входа.
app.post("/login", (req, res) => {
  var { login, password } = req.body;
  fs.readFile("users.json", function (err, data) {
    //Начинаем чтение файла users.json
    users = JSON.parse(data);
    console.log(users);
});
  if (//Если были найдены совпадения, то авторизируем пользоватедя и задаем ему куки
    users.find((user) => user.login === login && user.password === password)
  ) {
    res.cookie("isLogin", true, cookieOptions);
    //console.log(data);
    res.redirect("/tableget");
    return;
  } else {
    res.render("login", {
      layout: "fourd",
      message: "Please try again",
      messageClass: "alert-success",
    });
  }
});

//Отрабатываем выход пользователя из "Аккаунта"
app.delete('/login',(req,res) => {
  console.log('hello i deleted coockie');
  res.cookie('isLogin','false',cookieOptions);
  res.send('');
});

//Отображаем страницу регистрации
app.get("/register", (req, res) => {
  res.render("registration", { layout: "fourd" });
});

//Здесь происходит тоже самое, что и со входом, только здесь мы проверяем уникальность нового пользователя, если совпадений нет
//То мы добавляем его в файл users.json
//Если есть, то выкидываем ошибку
app.post("/register", (req, res) => {
  var { login, password } = req.body;
  fs.readFile("users.json", function (err, data) {
      users = JSON.parse(data);
      console.log(users);
  });

  console.log(users);
    if (
    users.find((user) => user.login === login && user.password === password)
  ) {
    res.render("registration", {
      layout: "fourd",
      message: "User already registered.",
      messageClass: "alert-danger",
    });
    return;
  }

  users.push({
    login,
    password,
  });
  fs.writeFile("users.json", JSON.stringify(users), (err, result) => {
  });
  res.render("login", {
    layout: "fourd",
    message: "Registration Compete.Please login to continue",
    messageClass: "alert-success",
  });
});

app.listen(port, () => console.log(`App listening http://localhost:8080`));
