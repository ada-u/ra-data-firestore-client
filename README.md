# ra-data-firestore-client

A Firestore Client for the awesome [react-admin](https://github.com/marmelab/react-admin) framework. 
This library is a modified version of [aymendhaya/ra-data-firebase-client](https://github.com/aymendhaya/ra-data-firebase-client)

## For a quick demo:
clone the repo & run 

```bash
npm install 
```

```bash
npm run init 
```

```bash
npm run demo 
```
## To install & test RestProvider & AuthProvider:

```bash
npm install ra-data-firestore-client-ada-u
```
Check [example implementation](https://github.com/rafalzawadzki/ra-data-firestore-client/blob/master/src/demo/App.js).


For AuthProvider, don't forget to add the user UID to your Firestore DB under /users matching the following structure:

```bash
"users": {
    "UID": {
        "isAdmin": true
    }
}
```

## ra-data-firestore-client also supports `base64` image uploading. 
