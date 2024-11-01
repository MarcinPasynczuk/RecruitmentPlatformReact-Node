const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const upload = multer();

const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'xxx'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');

  db.query('CREATE DATABASE IF NOT EXISTS hospitoolityjobs', (err) => {
    if (err) {
      console.error('Error creating database:', err);
      return;
    }
    console.log('Database created or already exists');

    db.changeUser({ database: 'hospitoolityjobs' }, (err) => {
      if (err) {
        console.error('Error switching to database:', err);
        return;
      }
      console.log('Switched to hospitoolityjobs database');

      const createJobOffersTable = `
        CREATE TABLE IF NOT EXISTS job_offers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          job_title VARCHAR(255) NOT NULL,
          job_description TEXT,
          responsibilities TEXT,
          requirements TEXT,
          benefits TEXT,
          stages_count INT DEFAULT 0
        )
      `;
      db.query(createJobOffersTable, (err) => {
        if (err) {
          console.error('Error creating job_offers table:', err);
          return;
        }
        console.log('job_offers table created or already exists');
      });

      db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL
      )`, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
        } else {
          console.log('Users table created successfully');
          const insertUserQuery = 'INSERT IGNORE INTO users (username, password) VALUES (?, ?)';
          db.query(insertUserQuery, ['test', 'test'], (err) => {
            if (err) {
              console.error('Error inserting test user:', err);
            } else {
              console.log('Test user inserted successfully');
            }
          });
        }
      });

      const createApplicationsTable = `
        CREATE TABLE IF NOT EXISTS applications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          applicant_name VARCHAR(255) NOT NULL,
          applicant_email VARCHAR(255) NOT NULL,
          phone_number VARCHAR(20),
          job_offer_id INT,
          cover_letter TEXT,
          agree_to_terms BOOLEAN,
          resume LONGBLOB,
          cv_checked BOOLEAN DEFAULT 0,
          FOREIGN KEY (job_offer_id) REFERENCES job_offers(id)
        )
      `;
      db.query(createApplicationsTable, (err) => {
        if (err) {
          console.error('Error creating applications table:', err);
          return;
        }
        console.log('applications table created or already exists');
      });
    });
  });
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'xxx',
    pass: 'xxx'
  }
});

// Routes

app.get('/api/joboffers', (req, res) => {
  const query = 'SELECT id, job_title, job_description, responsibilities, requirements, benefits, stages_count FROM job_offers';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching job offers:', err);
      res.status(500).send('Error fetching job offers');
    } else {
      res.json(results);
    }
  });
});

app.get('/api/job/:id', (req, res) => {
  const jobId = req.params.id;
  const query = 'SELECT id, job_title, job_description, responsibilities, requirements, benefits, stages_count FROM job_offers WHERE id = ?';
  db.query(query, [jobId], (err, result) => {
    if (err) {
      console.error('Error fetching job:', err);
      res.status(500).send('Error fetching job');
    } else if (result.length === 0) {
      res.status(404).send('Job not found');
    } else {
      res.json(result[0]);
    }
  });
});

app.get('/api/applications', (req, res) => {
  const query = 'SELECT * FROM applications';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching applications:', err);
      res.status(500).send('Error fetching applications');
    } else {
      res.json(results);
    }
  });
});


app.post('/api/job', (req, res) => {
  const { job_title, job_description, responsibilities, requirements, benefits } = req.body;
  const query = 'INSERT INTO job_offers (job_title, job_description, responsibilities, requirements, benefits, stages_count) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(query, [job_title, job_description, responsibilities, requirements, benefits, 0], (err, result) => {
    if (err) {
      console.error('Error adding job offer:', err);
      res.status(500).send('Error adding job offer');
    } else {
      res.status(201).json({ id: result.insertId, job_title, job_description, responsibilities, requirements, benefits });
    }
  });
});

app.post('/api/application', upload.single('resume'), (req, res) => {
  const { applicant_name, email, phone_number, job_offer_id, cover_letter, agreeToTerms } = req.body;
  const resume = req.file;

  if (!resume) {
    return res.status(400).send('Resume is required');
  }

  const agreeToTermsValue = agreeToTerms === 'true' ? 1 : 0;

  const query = 'INSERT INTO applications (applicant_name, applicant_email, phone_number, job_offer_id, cover_letter, agree_to_terms, resume) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [applicant_name, email, phone_number, job_offer_id, cover_letter, agreeToTermsValue, resume.buffer], (err, result) => {
    if (err) {
      console.error('Error adding application:', err);
      res.status(500).send('Error adding application');
    } else {
      res.status(200).end();
    }
  });
});

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;

  const mailOptions = {
    from: email,
    to: 'office@hospitoolity.com',
    subject: `Contact Us Message from ${name}`,
    text: message
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
      res.status(500).send('Error sending email');
    } else {
      res.status(200).redirect('/thanksmail');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      res.status(500).send('Error during login');
    } else if (results.length === 0) {
      res.status(401).send('Invalid credentials');
    } else {
      res.json({ token: 'test-jwt-token' }); 
    }
  });
});

app.post('/api/check-cv', (req, res) => {
  const { id } = req.body;
  const query = 'UPDATE applications SET cv_checked = 1 WHERE id = ?';
  db.query(query, [id], (err) => {
    if (err) {
      console.error('Error checking CV:', err);
      res.status(500).send('Error checking CV');
    } else {
      res.status(200).send('CV checked successfully');
    }
  });
});

app.delete('/api/delete-application/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM applications WHERE id = ?';
  db.query(query, [id], (err) => {
    if (err) {
      console.error('Error deleting application:', err);
      res.status(500).send('Error deleting application');
    } else {
      res.status(200).send('Application deleted successfully');
    }
  });
});

app.get('/api/download-cover-letter/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT cover_letter FROM applications WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching cover letter:', err);
      res.status(500).send('Error fetching cover letter');
    } else if (results.length === 0) {
      res.status(404).send('Cover letter not found');
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="cover_letter.txt"');
      res.type('text/plain');
      res.send(results[0].cover_letter);
    }
  });
});

app.get('/api/download-resume/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT resume FROM applications WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching resume:', err);
      res.status(500).send('Error fetching resume');
    } else if (results.length === 0) {
      res.status(404).send('Resume not found');
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
      res.type('application/pdf');
      res.send(results[0].resume);
    }
  });
});

