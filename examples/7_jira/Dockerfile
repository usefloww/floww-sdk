FROM base-floww

# Build context is SDK root, copy pre-built SDK tarball
COPY floww-*.tgz /tmp/

# Setup /var/task with SDK
WORKDIR /var/task
# Create a minimal package.json for npm to work correctly
RUN echo '{"type":"module","dependencies":{"floww":"*"}}' > package.json && \
    npm install /tmp/floww-*.tgz && \
    rm -rf /tmp/*.tgz

# Set entrypoint from config
ENV FLOWW_ENTRYPOINT=main.ts

# No source code copying - code will be provided via Lambda event payload
# Uses the universal handler from base-floww image
