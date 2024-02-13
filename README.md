## How to Clone and Run the Project

To get started with this project, follow these steps:

### Step 1: Clone the Repository

```bash
git clone https://github.com/noamzuck/Upload-Web-2-MGV.git
```

### Step 2: Navigate to the Project Directory

```bash
cd Upload-Web-2-MGV
```

### Step 4: Build and Start Docker Containers

```bash
docker-compose up --build
```

### Step 5: Access the Application
Once the containers are up and running, check the logs of the server container and make sure all the npm packages were installed and the server running on port 3000. After that, you can access the application by navigating to http://localhost:3000 in your web browser.

### Step 6: Shut Down the Containers

```bash
docker-compose down
```
