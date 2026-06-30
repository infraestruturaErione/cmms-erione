Set the environment variables not starting with `REACT_APP` from [here](../README.MD#set-environment-variables)

Without docker, you should first install and use JDK 17 then create a Postgres database. After that go
to [src/main/resources/application-dev.yml](src/main/resources/application-dev.yml), change the url, username and
password.

```shell
mvn spring-boot:run
```
