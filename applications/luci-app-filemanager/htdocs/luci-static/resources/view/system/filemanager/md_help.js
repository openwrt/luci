return L.Class.extend({
	// Define the Help content in Markdown format
	helpContentMarkdown: `
# LuCI OpenWrt File Manager Application Help

## Introduction
The **LuCI OpenWrt File Manager** is a tool to navigate directories, manage files, edit content, and customize the application's settings.

## Key Features

1. **Tabbed Interface**
   - **File Manager Tab**: Primary interface for browsing and managing files and directories.
   - **Editor Tab**: Advanced tool for editing file contents in both text and hexadecimal formats.
   - **Settings Tab**: Customize the application's appearance and behavior according to your preferences.
   - **Help Tab**: Access detailed instructions and information about the application's features and functionalities.

2. **File Management**
   - **View Files and Directories**: Display a list of files and folders within the current directory.
   - **Navigate Directories**: Move into subdirectories or return to parent directories.
   - **Resizable Columns**: Adjust the width of table columns to enhance readability and organization.
   - **Drag-and-Drop Uploads**: Upload files by simply dragging them into the designated area.
   - **Upload via File Selector**: Use the "Upload File" button to select and upload files from your local machine.
   - **Create New Files and Folders**:
     - **Create Folder**: Instantiate new directories within the current path.
     - **Create File**: Generate new empty files for content creation or editing.
   - **File Actions**:
     - **Edit**: Modify the contents of files directly within the application.
     - **Duplicate**: Create copies of existing files or directories.
     - **Delete**: Remove selected files or directories permanently.
     - **Download**: Save copies of files to your local machine for offline access.

3. **Selection and Bulk Actions**
   - **Select All**: Quickly select or deselect all files and directories within the current view using the "Select All" checkbox.
   - **Invert Selection**: Reverse the current selection of files and directories, selecting previously unselected items and vice versa.
   - **Individual Selection**: Select or deselect individual files and directories using the checkboxes next to each item.
   - **Bulk Delete**: Remove multiple selected items simultaneously for efficient management.

4. **Advanced Editing**
   - **Text Editor**:
     - **Line Numbers**: Toggle the display of line numbers to assist in content navigation.
     - **Save Changes**: Commit edits directly to the server.
   - **Hex Editor**:
     - **Binary Editing**: Modify file contents at the byte level for advanced users.
     - **ASCII, HEX and RegExp search**: Search for a pattern in the file and navigate to it.
     - **Switch Between Modes**: Seamlessly toggle between text and hex editing modes.
     - **Save Changes**: Apply and save binary modifications.

5. **User Notifications and Status Indicators**
   - **Progress Bars**: Visual indicators for ongoing operations like file uploads and deletions.
   - **Notifications**: Informational messages alert users about the success or failure of actions performed.

6. **Customizable Settings**
   - **Interface Customization**:
     - **Column Widths**: Define the width of each column in the file list for optimal viewing.
     - **Window Sizes**: Adjust the size of the file list container and editor windows.
     - **Padding**: Set padding values to control the spacing within the interface.
   - **Persistent Configuration**: Save your settings to ensure a consistent user experience across sessions.

## How to Use the Application

1. **Accessing the Application**
   - Navigate to your OpenWrt device's LuCI web interface.
   - Locate and select the **File Manager** application from **System** menu .

2. **Navigating the Interface**
   - **Tabs**: Use the top navigation tabs to switch between **File Manager**, **Editor**, **Settings**, and **Help**.
   - **File Manager Tab**:
     - Browse through directories by clicking on folder names.
     - Use the "Go" button or press "Enter" after typing a path in the path input field to navigate to specific directories.
   - **Editor Tab**:
     - Select a file from the File Manager to open it in the Editor.
     - Choose between text or hex editing modes using the toggle buttons.
   - **Settings Tab**:
     - Adjust interface settings such as column widths, window sizes, and padding.
     - Save your configurations to apply changes immediately.
   - **Help Tab**:
     - Access detailed instructions and information about the application's features and functionalities.

3. **Managing Files and Directories**
   - **Uploading Files**:
     - **Drag and Drop**: Drag files from your local machine and drop them into the **File List Container** to upload.
     - **File Selector**: Click the "Upload File" button to open a file dialog and select files for uploading.
   - **Creating Files/Folders**:
     - Click on "Create File" or "Create Folder" buttons and provide the necessary names to add new items.
   - **Editing Files**:
     - Select a file and click the edit icon (✏️) to modify its contents in the Editor tab.
   - **Duplicating Files/Folders**:
     - Use the duplicate icon (📑) to create copies of selected items.
   - **Deleting Items**:
     - Select one or multiple items using checkboxes and click the delete icon (🗑️) or use the "Delete Selected" button for bulk deletions.
   - **Downloading Files**:
     - Click the download icon (⬇️) next to a file to save it to your local machine.

4. **Using Selection Features**
   - **Select All**:
     - Use the "Select All" checkbox located in the table header to select or deselect all files and directories in the current view.
   - **Invert Selection**:
     - Hold the "Alt" key and click the "Select All" checkbox to invert the current selection, selecting all unselected items and deselecting previously selected ones.
   - **Individual Selection**:
     - Click on the checkbox next to each file or directory to select or deselect it individually.

5. **Using the Editor**
   - **Text Mode**:
     - Edit the content of text files with features like line numbers and real-time updates.
     - Save your changes by clicking the "Save" button.
   - **Hex Mode**:
     - Perform binary editing on files for advanced modifications.
     - Perform ASCII, HEX and RegExp pattern search in the file.
     - Toggle between text and hex modes as needed.
     - Save changes to apply your edits.
     - **Quick Access**: Hold the "Alt" key and click on file names or links to open files directly in the hex editor.


6. **Customizing Settings**
   - Navigate to the **Settings Tab** to personalize the application's layout and behavior.
   - Adjust parameters such as column widths, window sizes, and padding to suit your preferences.
   - Save settings to ensure they persist across sessions.

## Additional Functionalities

- **Resizable Columns and Windows**: Enhance the interface's flexibility by resizing table columns and editor windows to match your workflow. The Help window starts at **650x600** pixels and can be adjusted as needed.
- **Responsive Design**: The application adapts to different screen sizes, ensuring usability across various devices.
- **Error Handling and Notifications**: Receive immediate feedback on actions, helping you stay informed about the status of your file management tasks.
- **Line Number Toggle**: Easily show or hide line numbers in the text editor to assist with content navigation.
- **Bulk Operations**: Efficiently manage multiple files or directories through bulk actions like delete and duplicate.
- **Symlink Handling**: Navigate and manage symbolic links seamlessly within the file structure.
`
});
