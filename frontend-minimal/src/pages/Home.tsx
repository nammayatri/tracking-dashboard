import React from 'react';
import { Typography, Paper, Box } from '@mui/material';
import Layout from '../components/Layout';

const Home: React.FC = () => {
  return (
    <Layout>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to Namma Yatri
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" paragraph>
            Your trusted platform for seamless transportation
          </Typography>
        </Box>
        <Box sx={{ mt: 4 }}>
          <Typography variant="body1" paragraph>
            Namma Yatri is a platform that connects passengers with reliable transportation services.
            We aim to provide a safe, convenient, and efficient way to travel.
          </Typography>
        </Box>
      </Paper>
    </Layout>
  );
};

export default Home; 