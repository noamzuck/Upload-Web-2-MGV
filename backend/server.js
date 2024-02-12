const express = require('express'); //The package of the server
const path = require('path'); //The package of the path
const multer = require('multer'); //The package that get the files
const Minio = require('minio'); //The package that saves files
const { MongoClient, ObjectId } = require('mongodb'); //The package of the database
const exiftool  = require('node-exiftool'); //The package of the metadata
const exiftoolBin = require('dist-exiftool'); //The package of the metadata
const fs = require('fs'); //The package that reads files

const mongoUrl = 'mongodb://admin:password@mongodb:27017'; //The url of the database

const storage = multer.memoryStorage(); //Where to store the files temporarily
const upload = multer({ storage: storage });
const app = express(); //Starts the server process

const minioClient = new Minio.Client({
    endPoint: 'host.docker.internal',
    port: 9000,
    useSSL: false,
    accessKey: 'minioAkey',
    secretKey: 'minioSkey',
}); //Defines the minio client

app.use('/src', express.static(path.join(__dirname + '/../frontend/src'))); //gives you access to the "src" folder

app.get('/manifest.json', function (req, res) {
    res.sendFile(path.join(__dirname + '/../frontend/public/manifest.json'));
}); //Gives you access to the "manifest.json" file

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/../frontend/public/index.html'));
}); //Gives you access to the main page

app.get('/stats', function (req, res) {
    res.sendFile(path.join(__dirname + '/../frontend/public/stats.html'));
}); //Gives you access to the stats page

app.post('/file', upload.single('file'), async (req, res) => {
    const file = req.file, id = req.body.id;
    if(!id || !file) return res.status(400).send('Not enough data provided.');

    await fs.writeFileSync(path.join(__dirname + "/tmp/", file.originalname), file.buffer);

    const ep = new exiftool.ExiftoolProcess(exiftoolBin)
    await ep.open().then(() => 'Exiftool started').catch(err => 'Error starting exiftool: ' +  err);
    let metaData = await ep.readMetadata("../tmp/" + file.originalname, ['-File:all']);
    metaData = (metaData.data == null) ? {} : metaData.data[0];
    for(let item in metaData) {
        if(/[^\x00-\x7F]/.test(item) || /[^\x00-\x7F]/.test(metaData[item]) || item.includes('-')) delete metaData[item];
    }
    delete metaData.SourceFile;
    delete metaData.ExifToolVersion;

    metaData = Object.fromEntries(Object.entries(metaData).slice(0, 20));

    await fs.unlinkSync(path.join(__dirname + "/tmp/", file.originalname));
    
    if (!ObjectId.isValid(id)) return res.send('Invalid ObjectId');

    const result = await minioClient.bucketExists(id)
    .then(async exists => {
        if(exists) return await uploadFile(file.originalname, file.buffer, metaData, id);
        else return await createTheMainBucket(id)
        .then(async () => {
            return await uploadFile(file.originalname, file.buffer, metaData, id);
        });
    })
    .catch(err => err);
    
    if(result == "File already exists") res.status(400).send(result);
    else res.send('Ok: ' + result);
}); //Gets the post request to upload a file

app.delete('/filename/:file/:id', async (req, res) => {
    const { file, id } = req.params;
    if(!id || !file) return res.status(400).send('Not enough data provided.');
    let newId;
    
    if (!ObjectId.isValid(id)) return res.send('Invalid ObjectId');
    else newId = new ObjectId(id);

    await minioClient.removeObjects(id, [file])
    .catch(err => res.send(err));

    await MongoClient.connect(mongoUrl)
    .then(async client => {
        const db = await client.db('UploadFilesMGV');
        collection = await db.collection('users');

        collection.findOneAndUpdate({ _id: new ObjectId(id) }, { $pull: { files: file } })
        .catch(() => 'Internal Server Error');
    })
    .catch(() => 'Error connecting to MongoDB');

    res.send('File deleted successfully.');
}); //Gets the delete request to delete a file

app.get('/statistics', async (req, res) => {
    const { id } = req.query;
    if(!id) return res.status(400).send('No id provided.');
    
    if (!ObjectId.isValid(id)) return res.send('Invalid ObjectId');

    await MongoClient.connect(mongoUrl)
    .then(async client => {
        const db = await client.db('UploadFilesMGV');
        const collection = await db.collection('users');

        if (!ObjectId.isValid(id)) return res.status(400).send('Invalid ObjectId');

        await collection.findOne({ _id: new ObjectId(id) })
        .then(async result => {
          if (result) res.json(result.stats);
          else res.status(404).send('User not found');
        })
        .catch(() => res.status(500).send('Internal Server Error'));
    })
    .catch(error => res.send('Error connecting to MongoDB', error));
}); //Sends the statistics data

app.get('/getLink', async (req, res) => {
    const { id, file } = req.query;
    if(!id || !file) return res.status(400).send('Not enough data provided.');
    
    if (!ObjectId.isValid(id)) return res.send('Invalid ObjectId');
    
    await minioClient.presignedGetObject(id, file, 604800)
    .then((url) => res.json({ link: url }))
    .catch((err) => res.status(500).send('Internal Server Error' + err));
}); //Sends the link to download the file

app.get('/getUser', async (req, res) => {
    const { id } = req.query;
    if(!id) return res.status(400).send('No id provided.');

    if (!ObjectId.isValid(id)) return res.status(400).send('Invalid ObjectId');

    await MongoClient.connect(mongoUrl)
    .then(async client => {
        const db = await client.db('UploadFilesMGV');
        const collection = await db.collection('users');

        await collection.findOne({ _id: new ObjectId(id) })
        .then(async result => {
          if (result) res.json(result);
          else res.status(404).send('User not found');
        })
        .catch(() => res.status(500).send('Internal Server Error'));
    })
    .catch(error => res.send('Error connecting to MongoDB', error));
}); //Sends the user information

app.get('/createAccount', async (req, res) => {
    await MongoClient.connect(mongoUrl)
    .then(async client => {
        const db = await client.db('UploadFilesMGV');
        const collection = await db.collection('users');

        res.json(await collection.insertOne({ files: [], stats: { 1: [], 2: {}, 3: {} } }));
    })
    .catch(error => res.send('Error connecting to MongoDB', error));
}); //Creates a new user account

app.get('/addStat', async (req, res) => {
    const { id, time, fileType, date } = req.query;
    if(!id || !time || !fileType || !date || !req.query.size) return res.status(400).send('Not enough data provided.');
    const size = parseInt(req.query.size);
    
    await MongoClient.connect(mongoUrl)
    .then(async client => {
        const db = await client.db('UploadFilesMGV');
        const collection = await db.collection('users');

        if (!ObjectId.isValid(id)) return res.status(400).send('Invalid ObjectId');

        const update = { $push: { "stats.1": { time: time, size: size } }, $inc: {} };
        update.$inc[`stats.2.${fileType}.size`] = size;
        update.$inc[`stats.2.${fileType}.amount`] = 1;
        update.$inc[`stats.3.${date.replaceAll('.', '/')}`] = size;

        await collection.updateOne({ _id: new ObjectId(id) }, update, { upsert: true })
        .then(() => res.send('Stat added successfully'))
        .catch((err) => res.status(500).send('Internal Server Error' + err));
    })
    .catch(error => res.send('Error connecting to MongoDB', error));
}); //Adds data to a user's statistics 

app.listen(3000, () => {
    console.log('Server is running on port 3000');
}); //Runs the server on port 3000


/***********/
/*FUNCTIONS*/
/***********/

async function uploadFile(name, buffer, metaData, id) {
    return await MongoClient.connect(mongoUrl)
    .then(async client => {
        const db = await client.db('UploadFilesMGV');
        collection = await db.collection('users');

        return await minioClient.statObject(id, name)
        .then(() => 'File already exists')
        .catch(async (err) => {
            if(err.code === 'NotFound') {
                return await minioClient.putObject(id, name, buffer, metaData)
                .then(async () => {
                    return await collection.findOne({ _id: new ObjectId(id) })
                    .then(async result => {
                        if (result) {
                            result._id = new ObjectId(id);
                            const tmp = { $set: JSON.parse(JSON.stringify(result)) };
                            tmp.$set.files.push(name);
                            delete tmp.$set._id;
                            return await collection.updateOne(result, tmp)
                            .then(resultUpdate => {
                                if (resultUpdate.modifiedCount === 1) return 'User updated successfully';
                                else return 'User not found';
                            })
                            .catch(() => 'Internal Server Error');
                        } else return 'User not found';
                    })
                    .catch(() => 'Internal Server Error');
                })
                .catch(err => err);
            } else return err;
        });
    })
    .catch(() => 'Error connecting to MongoDB');
} //A function to upload a file

async function createTheMainBucket(id) {
    return await minioClient.makeBucket(id, (err, etag) => {
        if(err) return err;
        return etag;
    });
} //A function to create the user's bucket