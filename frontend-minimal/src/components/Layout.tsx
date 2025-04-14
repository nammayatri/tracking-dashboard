import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Box, 
  Button, 
  IconButton, 
  useTheme, 
  useMediaQuery,
  Avatar,
  Tooltip
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import DirectionsIcon from '@mui/icons-material/Directions';
import GitHubIcon from '@mui/icons-material/GitHub';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          backgroundColor: 'white', 
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                backgroundColor: 'primary.main', 
                width: 40, 
                height: 40, 
                mr: 1.5,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <DirectionsIcon />
            </Avatar>
            <Typography 
              variant="h6" 
              component={RouterLink} 
              to="/" 
              sx={{ 
                fontWeight: 600, 
                textDecoration: 'none', 
                color: 'inherit',
                letterSpacing: '0.5px'
              }}
            >
              Namma Yatri
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />
          
          {!isMobile && (
            <>
              <Button 
                color="primary" 
                component={RouterLink} 
                to="/" 
                sx={{ 
                  mr: 2, 
                  fontWeight: 500,
                  borderRadius: 2,
                  px: 2
                }}
              >
                Tracker
              </Button>
              <Button 
                color="inherit" 
                component={RouterLink} 
                to="/about" 
                sx={{ 
                  mr: 2,
                  fontWeight: 500,
                  borderRadius: 2,
                  px: 2
                }}
              >
                About
              </Button>
            </>
          )}
          
          <Tooltip title="View on GitHub">
            <IconButton 
              color="inherit" 
              aria-label="GitHub" 
              edge="end"
              sx={{ ml: 1 }}
            >
              <GitHubIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      <Container 
        component="main" 
        maxWidth="lg"
        sx={{ 
          mt: { xs: 2, sm: 4 }, 
          mb: { xs: 2, sm: 4 }, 
          px: { xs: 2, sm: 3 },
          flex: 1 
        }}
      >
        {children}
      </Container>
      
      <Box 
        component="footer" 
        sx={{ 
          py: 3, 
          mt: 'auto',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Namma Yatri. All rights reserved.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Real-time Vehicle Tracking
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout; 