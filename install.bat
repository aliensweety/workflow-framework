@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ============================================================
rem  Workflow Framework - Install / Update (Windows)
rem
rem  Single source of truth: project-template\.claude\skills\
rem  - Create new project: copy whole project-template
rem  - Update existing projects: sync framework skills only
rem ============================================================

set "SCRIPT_DIR=%~dp0"
set "TEMPLATE=%SCRIPT_DIR%project-template"
set "FRAMEWORK_SKILLS=%TEMPLATE%\.claude\skills"
set "PROJECTS_DIR=%SCRIPT_DIR%projects"

rem --- Sanity ---
if not exist "%TEMPLATE%" (
    echo [ERROR] project-template\ not found next to install.bat.
    pause
    exit /b 1
)
if not exist "%FRAMEWORK_SKILLS%" (
    echo [ERROR] project-template\.claude\skills\ not found.
    echo The framework skills should live there as the single source of truth.
    pause
    exit /b 1
)

:menu
cls
echo.
echo ================================================
echo   Workflow Framework
echo ================================================
echo.
echo   1. Create new project
echo   2. Update framework skills in all existing projects
echo   3. Exit
echo.
set "CHOICE="
set /p "CHOICE=Choose [1/2/3]: "

if "!CHOICE!"=="1" goto create_new
if "!CHOICE!"=="2" goto update_all
if "!CHOICE!"=="3" exit /b 0
echo Invalid choice.
timeout /t 2 >nul
goto menu

rem ============================================================
rem  CREATE NEW PROJECT
rem ============================================================
:create_new
echo.
echo ------------------------------------------------
echo   Create New Project
echo ------------------------------------------------
echo.

:ask_name
set "PROJECT_NAME="
set /p "PROJECT_NAME=Project name: "
if "!PROJECT_NAME!"=="" (
    echo Project name cannot be empty.
    goto ask_name
)
echo !PROJECT_NAME!| findstr /C:" " >nul
if not errorlevel 1 (
    echo Project name cannot contain spaces.
    goto ask_name
)

if not exist "%PROJECTS_DIR%" mkdir "%PROJECTS_DIR%"
set "PROJECT_DIR=%PROJECTS_DIR%\!PROJECT_NAME!"

if exist "!PROJECT_DIR!" (
    echo.
    echo [ERROR] Already exists: !PROJECT_DIR!
    echo Pick a different name or remove the existing directory first.
    pause
    goto menu
)

echo.
echo Creating: !PROJECT_DIR!
set /p "CONFIRM=Proceed? [Y/n] "
if /i "!CONFIRM!"=="n" goto menu

echo.
echo Copying template...
xcopy "%TEMPLATE%\*" "!PROJECT_DIR!\" /E /I /Y /Q >nul
if errorlevel 1 (
    echo [ERROR] Copy failed.
    pause
    goto menu
)

rem Remove the .gitkeep that lived in template's empty dirs
if exist "!PROJECT_DIR!\.claude\skills\.gitkeep" del /Q "!PROJECT_DIR!\.claude\skills\.gitkeep"
if exist "!PROJECT_DIR!\workflows\.gitkeep" del /Q "!PROJECT_DIR!\workflows\.gitkeep"
if exist "!PROJECT_DIR!\scripts\.gitkeep" del /Q "!PROJECT_DIR!\scripts\.gitkeep"
if exist "!PROJECT_DIR!\runs\.gitkeep" del /Q "!PROJECT_DIR!\runs\.gitkeep"

echo.
echo Done. Project created at:
echo   !PROJECT_DIR!
echo.
echo Top-level contents:
dir /B "!PROJECT_DIR!"
echo.
echo Next steps:
echo   cd "!PROJECT_DIR!"
echo   claude
echo.
echo Inside Claude Code:
echo   "Help me design a new workflow for X"
echo.
pause
goto menu

rem ============================================================
rem  UPDATE FRAMEWORK SKILLS IN ALL PROJECTS
rem ============================================================
:update_all
echo.
echo ------------------------------------------------
echo   Update Framework Skills - All Projects
echo ------------------------------------------------
echo.

if not exist "%PROJECTS_DIR%" (
    echo No projects\ directory yet. Nothing to update.
    pause
    goto menu
)

echo Source : %FRAMEWORK_SKILLS%
echo Target : %PROJECTS_DIR%\^<each-project^>\.claude\skills\
echo.
echo Will overwrite ONLY these framework items:
echo   - WORKFLOW_SCHEMA.md
echo   - workflow-compose\
echo   - workflow-run\
echo   - workflow-revise\
echo.
echo Project-private skills (gemini, grok, google-flow, etc.) NOT touched.
echo.
echo Projects that will be updated:

set "FOUND=0"
for /D %%P in ("%PROJECTS_DIR%\*") do (
    if exist "%%P\.claude\skills" (
        echo   - %%~nxP
        set "FOUND=1"
    )
)

if "!FOUND!"=="0" (
    echo   (none with .claude\skills\ folder)
    echo.
    pause
    goto menu
)

echo.
set /p "CONFIRM=Proceed? [Y/n] "
if /i "!CONFIRM!"=="n" goto menu

echo.
echo ------------------------------------------------

for /D %%P in ("%PROJECTS_DIR%\*") do (
    if exist "%%P\.claude\skills" (
        echo [UPDATE] %%~nxP

        rem Sync WORKFLOW_SCHEMA.md
        if exist "%FRAMEWORK_SKILLS%\WORKFLOW_SCHEMA.md" (
            copy /Y "%FRAMEWORK_SKILLS%\WORKFLOW_SCHEMA.md" "%%P\.claude\skills\WORKFLOW_SCHEMA.md"
            if errorlevel 1 (
                echo   [FAIL] WORKFLOW_SCHEMA.md
            ) else (
                echo   [OK]   WORKFLOW_SCHEMA.md
            )
        )

        rem Sync three framework skill folders
        for %%S in (workflow-compose workflow-run workflow-revise) do (
            if exist "%FRAMEWORK_SKILLS%\%%S" (
                if exist "%%P\.claude\skills\%%S" rmdir /S /Q "%%P\.claude\skills\%%S"
                xcopy "%FRAMEWORK_SKILLS%\%%S" "%%P\.claude\skills\%%S\" /E /I /Y /Q
                if errorlevel 1 (
                    echo   [FAIL] %%S\
                ) else (
                    echo   [OK]   %%S\
                )
            )
        )
    )
)

echo ------------------------------------------------
echo Done. Restart Claude Code in each project so it
echo picks up the new SKILL.md files.
echo.
pause
goto menu
