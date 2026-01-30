import { useState } from 'react';

export const ComponentsPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('tab1');
  const [accordionOpen, setAccordionOpen] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState(50);
  const [toggleStates, setToggleStates] = useState({
    darkMode: false,
    notifications: true,
    autoSave: false,
  });

  const showNotification = () => {
    setNotificationVisible(true);
    setTimeout(() => setNotificationVisible(false), 3000);
  };

  const handleToggle = (key: keyof typeof toggleStates) => {
    setToggleStates((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAccordion = (section: string) => {
    setAccordionOpen(accordionOpen === section ? null : section);
  };

  return (
    <div className="components-page">
      <h2>Interactive Components Demo</h2>
      <p>
        This page showcases various interactive UI components. Every interaction
        is tracked and stored locally, demonstrating the comprehensive event
        tracking capabilities.
      </p>

      <div className="components-grid">
        {/* Buttons Section */}
        <div className="component-section">
          <h3>Buttons & Actions</h3>
          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={() => alert('Primary action triggered!')}
            >
              Primary Button
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => console.log('Secondary action')}
            >
              Secondary Button
            </button>
            <button
              className="btn btn-danger"
              onClick={() => confirm('Are you sure?')}
            >
              Danger Button
            </button>
            <button className="btn btn-success" onClick={showNotification}>
              Show Notification
            </button>
          </div>
        </div>

        {/* Modal Section */}
        <div className="component-section">
          <h3>Modal Dialog</h3>
          <button
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
          >
            Open Modal
          </button>

          {modalOpen && (
            <div className="modal-overlay" onClick={() => setModalOpen(false)}>
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <h3>Demo Modal</h3>
                <p>
                  This is a modal dialog that demonstrates overlay interactions.
                </p>
                <div className="modal-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      alert('Modal action executed!');
                      setModalOpen(false);
                    }}
                  >
                    Execute Action
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs Section */}
        <div className="component-section">
          <h3>Tabs Navigation</h3>
          <div className="tabs-container">
            <div className="tabs-header">
              <button
                className={`tab-button ${selectedTab === 'tab1' ? 'active' : ''}`}
                onClick={() => setSelectedTab('tab1')}
              >
                Overview
              </button>
              <button
                className={`tab-button ${selectedTab === 'tab2' ? 'active' : ''}`}
                onClick={() => setSelectedTab('tab2')}
              >
                Features
              </button>
              <button
                className={`tab-button ${selectedTab === 'tab3' ? 'active' : ''}`}
                onClick={() => setSelectedTab('tab3')}
              >
                Settings
              </button>
            </div>
            <div className="tab-content">
              {selectedTab === 'tab1' && (
                <div>
                  <h4>Overview</h4>
                  <p>
                    This tab contains overview information. Tab switching is
                    being tracked.
                  </p>
                </div>
              )}
              {selectedTab === 'tab2' && (
                <div>
                  <h4>Features</h4>
                  <ul>
                    <li>Real-time event tracking</li>
                    <li>Local data storage</li>
                    <li>MCP protocol integration</li>
                  </ul>
                </div>
              )}
              {selectedTab === 'tab3' && (
                <div>
                  <h4>Settings</h4>
                  <p>Configuration options would be shown here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Switches */}
        <div className="component-section">
          <h3>Toggle Switches</h3>
          <div className="toggle-group">
            <div className="toggle-item">
              <label>
                Dark Mode
                <input
                  type="checkbox"
                  checked={toggleStates.darkMode}
                  onChange={() => handleToggle('darkMode')}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>
            <div className="toggle-item">
              <label>
                Enable Notifications
                <input
                  type="checkbox"
                  checked={toggleStates.notifications}
                  onChange={() => handleToggle('notifications')}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>
            <div className="toggle-item">
              <label>
                Auto Save
                <input
                  type="checkbox"
                  checked={toggleStates.autoSave}
                  onChange={() => handleToggle('autoSave')}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Slider Section */}
        <div className="component-section">
          <h3>Range Slider</h3>
          <div className="slider-container">
            <label htmlFor="demo-slider">Value: {sliderValue}%</label>
            <input
              id="demo-slider"
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => setSliderValue(parseInt(e.target.value))}
              className="slider"
            />
          </div>
        </div>

        {/* Accordion Section */}
        <div className="component-section full-width">
          <h3>Accordion Sections</h3>
          <div className="accordion">
            <div className="accordion-item">
              <button
                className={`accordion-header ${accordionOpen === 'section1' ? 'active' : ''}`}
                onClick={() => toggleAccordion('section1')}
              >
                How does MCP-FE work?
              </button>
              {accordionOpen === 'section1' && (
                <div className="accordion-content">
                  <p>
                    MCP-FE turns your browser into an active participant in the
                    MCP ecosystem. It tracks user interactions locally and makes
                    them available to AI agents on-demand through the Model
                    Context Protocol.
                  </p>
                </div>
              )}
            </div>

            <div className="accordion-item">
              <button
                className={`accordion-header ${accordionOpen === 'section2' ? 'active' : ''}`}
                onClick={() => toggleAccordion('section2')}
              >
                What data is being tracked?
              </button>
              {accordionOpen === 'section2' && (
                <div className="accordion-content">
                  <p>
                    We track clicks, navigation events, form submissions, input
                    changes, and UI state changes. All data is stored locally in
                    IndexedDB and never sent to servers unless explicitly
                    requested by an AI agent.
                  </p>
                </div>
              )}
            </div>

            <div className="accordion-item">
              <button
                className={`accordion-header ${accordionOpen === 'section3' ? 'active' : ''}`}
                onClick={() => toggleAccordion('section3')}
              >
                Is my data secure?
              </button>
              {accordionOpen === 'section3' && (
                <div className="accordion-content">
                  <p>
                    Yes! All tracking data stays in your browser's IndexedDB.
                    It's never automatically sent to external servers. AI agents
                    can only access it through the MCP protocol when you
                    explicitly allow it.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notificationVisible && (
        <div className="notification success">
          <span>✓ Notification triggered! This interaction was tracked.</span>
          <button onClick={() => setNotificationVisible(false)}>×</button>
        </div>
      )}
    </div>
  );
};
