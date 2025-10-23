I recently added provider types to my backend in @floww-backend/app/routes/provider_types.py, 

The idea is that you do `getProvider("gitlab")` inside of the entrypoint file of an application

and this should trigger the following
1. after evaling the code, a list of "used" providers should be extracted
2. It should be checked if the used providers are available in the api
3. For those that are, nothing to do
4. For those that are not, fetch the /provider_types/<type>
    - Prompt the user to set it up using the "setup_steps" returned in the body
    - After setting it store the newly created provider in the api POST /providers


Additionally I also want to be able to manage existing providers using the cli with something like
floww manage providers which then shows all the existing providers in the namespace and then additionally allows selecting one and editing it, or removing it


To check the endpoints check the floww-backend/app/routes folder
